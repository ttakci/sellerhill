import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BlacklistAction,
  BlacklistType,
  DEFAULT_LISTING_TEMPLATE_HTML,
  EBAY_DESCRIPTION_MAX_LENGTH,
  EBAY_TITLE_MAX_LENGTH,
  TemplateType,
  buildListingTemplateContext,
  buildStoreStreetLine,
  calculateListingPrice,
  renderListingTemplate,
  type ListingPriceMetrics,
  type ListingSettingsGroup,
  type ProductData,
  type StoreSettingsResponse,
} from '@repo/shared';

import {
  extractVisibleText,
  sanitizeHtml,
  sanitizeListingHtml,
  sanitizeStringArray,
  truncateHtml,
} from '../../common/utils/sanitize';
import { ListingSettingsGroupService } from '../listing-settings-groups/listing-settings-group.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import { ContentGenerationService } from './content-generation.service';
import { containsBlacklistedKeyword } from './listing-blacklist';
import { applyContentRules, stripContactDetails } from './listing-content-rules';
import type { StrategyCommerce } from './listing-pricing.helpers';
import {
  normalizeTitleWhitespace,
  stripBrandFromTitle,
  truncateTitleAtWordBoundary,
} from './listing-title';

/**
 * A live listing would be priced from an Amazon price that is unknown or 0.
 *
 * Provider-neutral: the scraper can read "In Stock" while the price block is
 * unreadable, and Keepa maps a missing Buy Box price to 0. Pricing from 0 hands
 * back fees + fixed profit (or the price floor), so every sale would buy the
 * item on Amazon at full price. A draft may still be saved; publishing it
 * re-checks. Terminal for the attempt — see `classifyListingFailure`.
 */
export class SourcePriceUnavailableError extends Error {
  override name = 'SourcePriceUnavailableError';
  constructor(asin: string) {
    super(`Cannot list ASIN ${asin}: the Amazon price is unknown or 0.`);
  }
}

/**
 * The one price check every path that publishes to eBay calls. The create
 * worker and the draft-publish path call it themselves BEFORE the EPS image
 * upload (so a refused item spends no upload), and `prepareListingData`
 * re-checks under `live` before any LLM spend — the net for a caller that
 * forgets the early call.
 */
export function assertSourcePricePublishable(product: Pick<ProductData, 'asin' | 'price'>): void {
  if (!(Number(product.price?.current) > 0)) {
    throw new SourcePriceUnavailableError(product.asin || 'unknown');
  }
}

@Injectable()
export class ListingStrategyService {
  private readonly logger = new Logger(ListingStrategyService.name);

  constructor(
    private readonly settingsGroupService: ListingSettingsGroupService,
    private readonly storeSettingsService: StoreSettingsService,
    private readonly contentGeneration: ContentGenerationService
  ) {}

  /**
   * Calculate final price and stock based on product data and settings group.
   *
   * @param options.applyContentAi — **create path only**. When true and group AI flags
   * are on, may call the shared LLM client. Product-sync / Keepa refresh must pass false (default)
   * so we never rewrite 100k titles on every price tick.
   * @param options.live — the result will be published to eBay now (a live
   * create or a draft publish). Refuses a non-positive source price; a draft
   * create and an import of an already-live eBay listing leave it unset.
   */
  async prepareListingData(
    userId: string,
    sourceProduct: ProductData,
    settingsGroupId: string,
    storeId: string | null = null,
    options?: { applyContentAi?: boolean; live?: boolean }
  ) {
    // Checked first, before the settings lookup and any LLM spend.
    if (options?.live) {
      assertSourcePricePublishable(sourceProduct);
    }
    const group = await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId);
    const storeSettings = await this.storeSettingsService.getResolvedSettings(userId, storeId);

    // Everything below works on the LISTABLE copy: the seller's "remove this
    // word" keywords are out, contact details are out, and — with the hide-
    // brand rule — so are the brand, its specifics and the barcodes. Applied
    // once, here, so the title, the template, the AI rewrite and what is sent
    // to eBay can never disagree about what was removed.
    const hideBrand = group.listingRules.hideBrand;
    const product = applyContentRules(sourceProduct, {
      blacklist: storeSettings.blacklist,
      checkBlacklist: storeSettings.checkBlacklist,
      hideBrand,
    });
    // Hiding the brand removes it from `product`, but the title still carries
    // it as text — the title strip and the AI rewrite need the real name.
    const brandForTitle = sourceProduct.brand;

    let title = this.buildListingTitle(product, group, brandForTitle, hideBrand);

    const applyAi = Boolean(options?.applyContentAi);
    const wantAiTitle = applyAi && Boolean(group.content?.aiTitleEnabled);
    const wantAiDescription = applyAi && Boolean(group.content?.aiDescriptionEnabled);
    const aiAvailable =
      (wantAiTitle || wantAiDescription) && (await this.contentGeneration.isEnabled());
    const stripBrand = hideBrand || Boolean(group.content?.stripBrandFromTitle);
    const aiProduct = hideBrand ? { ...product, brand: brandForTitle } : product;

    // The title is settled BEFORE the template renders. `{{title}}` used to be
    // fed `product.title` — the raw Amazon one — so the description showed a
    // different title than the listing itself: the seller's brand-strip setting
    // was ignored there, and an AI-rewritten title never reached it at all,
    // because the rewrite ran after the template had already been rendered.
    // `rewriteTitle` reads the full source from `product.title` and never looks
    // at `baseDescription`, so nothing here needs the description to exist yet.
    if (aiAvailable && wantAiTitle) {
      // Model output is untrusted for length/whitespace as much as for content.
      title = truncateTitleAtWordBoundary(
        normalizeTitleWhitespace(
          await this.contentGeneration.rewriteTitle({
            product: aiProduct,
            baseTitle: title,
            baseDescription: '',
            stripBrand,
          })
        ),
        EBAY_TITLE_MAX_LENGTH
      );
    }

    let description = await this.processDescriptionTemplate(product, group, title);

    if (aiAvailable && wantAiDescription) {
      const aiDescription = await this.contentGeneration.rewriteDescription({
        product: aiProduct,
        baseTitle: title,
        baseDescription: description,
        stripBrand,
      });
      // Model output is untrusted for contact details too: it is written from
      // the source copy and may repeat an address the clean-up took out.
      description = truncateHtml(
        stripContactDetails(sanitizeListingHtml(aiDescription)),
        EBAY_DESCRIPTION_MAX_LENGTH
      );
    }

    if (!aiAvailable && applyAi && (group.content?.aiTitleEnabled || group.content?.aiDescriptionEnabled)) {
      this.logger.debug(
        `Content AI flags on for group but LLM_CONTENT_ENABLED is false — using deterministic title/description`
      );
    }

    // Validate listing against store settings (Blacklist, etc.) — after AI so blacklist still applies
    this.validateListing(title, description, product, storeSettings, sourceProduct);

    const priceMetrics = this.calculatePrice(
      product.price.current,
      group,
      Number(storeSettings.amazonTaxRate) || 0
    );

    // Stock Logic: Subtract buffer from Amazon stock, cap at user's max listing quantity.
    // See calculateQuantity() for the canonical formula (shared by all stock-compute paths).
    const amazonStock = product.stock ?? 0;
    const quantity = this.calculateQuantity(amazonStock, group, product.maxOrderQuantity);

    const defaultQuantity = group.stock?.defaultQuantity || 1;
    const stockBuffer = group.stock?.stockBuffer ?? 0;
    this.logger.debug(
      `Stock calculation for ${product.asin || 'product'}: ` +
        `Amazon stock=${amazonStock}, Buffer=${stockBuffer}, ` +
        `Available=${Math.max(amazonStock - stockBuffer, 0)}, Max listing qty=${defaultQuantity}, ` +
        `Final quantity=${quantity} (${quantity === 0 ? 'OUT OF STOCK' : 'IN STOCK'})`
    );

    return {
      title,
      description,
      price: priceMetrics.finalPrice,
      purchasePrice: priceMetrics.purchasePrice,
      estimatedProfit: priceMetrics.estimatedProfit,
      profitMargin: priceMetrics.profitMargin,
      roi: priceMetrics.roi,
      quantity,
      imageUrls: product.imageUrls,
      currency: product.price.currency,
      brand: product.brand,
      features: product.features || [],
      specs: product.specs || {},
      identifiers: product.identifiers || {},
      asin: product.asin,
      category: product.category,
      categoryPath: product.categoryPath,
      // Seller address from Store Settings (Store > Global). `city` used to be
      // absent here entirely, so `ebay.service.ts` sent the STATE as the city
      // on every inventory location; `address1` was never populated at all, so
      // eBay received the literal string 'Use Store Address' as the street.
      country: storeSettings.country || 'US',
      postalCode: storeSettings.zipCode,
      location: storeSettings.state,
      city: storeSettings.shipFromCity,
      address1: buildStoreStreetLine({
        city: storeSettings.shipFromCity,
        state: storeSettings.state,
      }),
    };
  }

  /**
   * Price + quantity only — the refresh fan-out's path.
   *
   * `prepareListingData` also builds the title, renders the full HTML
   * description template (which can hit the DB for a predefined template),
   * sanitizes it and runs blacklist validation. The fan-out discarded every
   * bit of that and kept six numbers, so at 1M listings on a 12h cycle it was
   * paying two DB round-trips plus a template render per listing per cycle for
   * output nobody read.
   *
   * A caller resolving many listings that share a settings group passes `group`
   * so the lookup happens once per batch instead of once per listing.
   *
   * `amazonTaxRatePct` is the caller's job to resolve (and cache across a
   * batch) — this method never reads store settings itself, for the same
   * reason it accepts `group`: a fan-out over many listings must not pay a
   * DB round trip per listing for a value that is the same for every listing
   * on the same store.
   */
  async computePricing(
    userId: string,
    product: ProductData,
    settingsGroupId: string,
    group?: ListingSettingsGroup,
    amazonTaxRatePct = 0,
    adRatePct = 0
  ): Promise<StrategyCommerce> {
    const resolved =
      group ?? (await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId));

    const priceMetrics = this.calculatePrice(product.price.current, resolved, amazonTaxRatePct, adRatePct);

    return {
      price: priceMetrics.finalPrice,
      quantity: this.calculateQuantity(product.stock ?? 0, resolved, product.maxOrderQuantity),
      purchasePrice: priceMetrics.purchasePrice,
      estimatedProfit: priceMetrics.estimatedProfit,
      profitMargin: priceMetrics.profitMargin,
      roi: priceMetrics.roi,
    };
  }

  /** Settings-group lookup exposed so a batch can resolve each group once. */
  async getSettingsGroup(userId: string, settingsGroupId: string): Promise<ListingSettingsGroup> {
    return this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId);
  }

  /**
   * Deterministic eBay title (brand strip + length). AI rewrite is applied later if enabled.
   */
  private buildListingTitle(
    product: ProductData,
    group: ListingSettingsGroup,
    brand: string | undefined = product.brand,
    hideBrand = false
  ): string {
    let title = normalizeTitleWhitespace(product.title || '');

    // The hide-brand store rule implies the title strip: a listing that sends
    // no brand to eBay but opens its title with it has hidden nothing.
    if ((hideBrand || group.content?.stripBrandFromTitle) && brand) {
      title = stripBrandFromTitle(title, brand);
    }

    title = truncateTitleAtWordBoundary(title, EBAY_TITLE_MAX_LENGTH);

    return title || product.asin || 'Product';
  }

  /**
   * Validate listing data against store settings (Blacklist, Length, etc.)
   */
  private validateListing(
    title: string,
    description: string,
    product: ProductData,
    settings: StoreSettingsResponse,
    // The brand check reads the SOURCE product: with the hide-brand rule the
    // listable copy has no brand left, and a blacklisted brand must still
    // refuse the product it belongs to.
    brandSource: Pick<ProductData, 'brand' | 'manufacturer'> = product
  ): void {
    const { checkBlacklist, blacklist } = settings;

    const validateBlacklist = (values: string[], type: BlacklistType): void => {
      for (const item of blacklist ?? []) {
        const keyword = item.keyword.trim();
        // A `remove` keyword never refuses a listing: it was already stripped
        // from the copy by `applyContentRules`.
        if (!keyword || !item.types.includes(type) || item.action === BlacklistAction.REMOVE) {
          continue;
        }

        // Whole-word, never substring — see `listing-blacklist.ts` for the six
        // live false positives ("gin" in "packaging") that rule exists to stop.
        if (containsBlacklistedKeyword(values, keyword)) {
          throw new BadRequestException(
            `${type} contains blacklisted keyword: ${item.keyword}`
          );
        }
      }
    };

    if (!title || title.trim().length === 0) {
      throw new BadRequestException('Listing title cannot be empty');
    }

    // Each keyword carries its own `types` (title/description/features/brand),
    // so `checkBlacklist` is the only remaining switch — on/off, not per-field.
    // Description deliberately scans buyer-visible text only, so Amazon-hosted
    // image URLs remain valid. Every field below matches whole words only;
    // `title` and the feature/spec/brand values are raw provider text, so a
    // substring match there was the same defect the visible-text rule fixed for
    // the description — just without the URL to make it obvious.
    if (!checkBlacklist) {
      return;
    }
    validateBlacklist([title], BlacklistType.TITLE);
    validateBlacklist([extractVisibleText(description)], BlacklistType.DESCRIPTION);
    validateBlacklist(
      [
        ...(product.features ?? []),
        ...Object.entries(product.specs ?? {}).flatMap(([name, value]) => [name, value]),
      ],
      BlacklistType.FEATURE_SPECIFICATION
    );
    validateBlacklist(
      [brandSource.brand ?? '', brandSource.manufacturer ?? ''],
      BlacklistType.BRAND_MANUFACTURER
    );
  }

  /**
   * Resolve the HTML template a settings group publishes with.
   *
   * PREDEFINED groups used to fall through to a bare `{{description}}` because
   * the branch was never implemented — the seeded designs users pick in the UI
   * simply never reached eBay. A missing/removed template id degrades to the
   * shared default rather than publishing an empty description.
   */
  private async resolveTemplateHtml(group: ListingSettingsGroup): Promise<string> {
    const templates = group.templates;

    if (templates?.type === TemplateType.CUSTOM) {
      const custom = templates.customTemplateHtml?.trim();
      return custom && custom.length > 0 ? custom : DEFAULT_LISTING_TEMPLATE_HTML;
    }

    if (templates?.predefinedTemplateId) {
      const html = await this.settingsGroupService.getPredefinedTemplateHtml(templates.predefinedTemplateId);
      if (html && html.trim().length > 0) {
        return html;
      }
      this.logger.warn(
        `Predefined template ${templates.predefinedTemplateId} not found for group ${group.id} — using default template`
      );
    }

    return DEFAULT_LISTING_TEMPLATE_HTML;
  }

  /**
   * Render the listing description from the group's template.
   *
   * Uses the SHARED renderer (`@repo/shared`) — the same one the settings-drawer
   * preview uses — so what a user previews is what a buyer sees. The old
   * backend-only replacer understood four placeholders and published the rest
   * (`{{{product_description}}}`, `{{#feature_bullets}}…`) as literal text on
   * live listings.
   */
  /**
   * @param listingTitle The title the LISTING will carry — brand-stripped,
   * truncated, and AI-rewritten if the group asks for it. Never `product.title`:
   * the description must not advertise a different title than the listing.
   */
  private async processDescriptionTemplate(
    product: ProductData,
    group: ListingSettingsGroup,
    listingTitle: string
  ): Promise<string> {
    const template = await this.resolveTemplateHtml(group);

    const features = sanitizeStringArray(product.features || []);
    const description = sanitizeHtml((product.description || '').trim());

    const context = buildListingTemplateContext({
      title: listingTitle,
      // Amazon descriptions are often empty; the feature bullets are then the
      // only real copy we have and must not be dropped silently.
      description: description || (features.length > 0 ? `<ul><li>${features.join('</li><li>')}</li></ul>` : ''),
      brand: product.brand,
      manufacturer: product.manufacturer,
      asin: product.asin,
      category: product.category,
      features,
      specs: product.specs,
      mainImageUrl: product.mainImageUrl,
      price: product.price?.current,
      currency: product.price?.currency,
    });

    const rendered = renderListingTemplate(template, context);
    const safe = truncateHtml(sanitizeListingHtml(rendered), EBAY_DESCRIPTION_MAX_LENGTH);

    if (safe.trim().length > 0) {
      return safe;
    }

    // Last resort: never publish an empty description box.
    return features.length > 0
      ? `<ul><li>${features.join('</li><li>')}</li></ul>`
      : sanitizeListingHtml(description);
  }

  /**
   * Canonical eBay listing quantity from (shared) Amazon stock + a group's stock policy.
   * quantity = min(max(amazonStock − buffer, 0), defaultQuantity, maxOrderQuantity)
   * e.g. defaultQuantity=3, buffer=5:
   *   Amazon=25 → min(max(25-5,0),3)=3  |  Amazon=7 → min(max(7-5,0),3)=2
   *   Amazon=6 → min(max(6-5,0),3)=1    |  Amazon=5 → min(max(5-5,0),3)=0 (out of stock)
   *
   * `maxOrderQuantity` is Amazon's own per-order purchase limit on the source
   * product (e.g. "Limit 4 per order"). One eBay order must be fulfillable by
   * one Amazon order, so the listed quantity can never exceed it.
   *
   * Single source of truth — used by listing creation, the 12h Keepa sync, and the
   * sale-driven stock-sync queue so every path computes quantity identically.
   */
  calculateQuantity(
    amazonStock: number,
    group: Pick<ListingSettingsGroup, 'stock'>,
    maxOrderQuantity?: number | null
  ): number {
    const defaultQuantity = group.stock?.defaultQuantity || 1;
    const stockBuffer = group.stock?.stockBuffer ?? 0;
    const cap = typeof maxOrderQuantity === 'number' && maxOrderQuantity > 0 ? maxOrderQuantity : Infinity;
    return Math.min(Math.max(amazonStock - stockBuffer, 0), defaultQuantity, cap);
  }

  /**
   * Calculate final eBay price + profit metrics for an Amazon price.
   *
   * Thin wrapper around the shared `calculateListingPrice` — the same pure
   * function the Listing Settings Group drawer's client-side "test your
   * settings" calculator calls, so the two can never drift apart. This
   * wrapper's only job is the diagnostic log when no price range covers the
   * Amazon price (the shared function stays free of a logger dependency).
   *
   * @param amazonTaxRatePct Store Settings' global "Amazon Satış Alış Vergi
   * Oranı" (`store_settings.amazon_tax_rate`) — an estimate of the sales tax
   * paid AT PURCHASE time on Amazon, before this listing has ever sold. It was
   * previously used only in `estimateProvisionalNetProfit` (a post-sale
   * estimate for orders still awaiting a real Amazon link) and played no part
   * in setting the eBay price itself — so a seller who configured it only saw
   * it reflected after a sale, never in what they were charging. It is a real
   * acquisition cost, so it now raises the price/cost basis too. The caller
   * resolves and caches it (see `computePricing`) — this method never reads
   * store settings itself.
   */
  private calculatePrice(
    amazonPrice: number,
    group: ListingSettingsGroup,
    amazonTaxRatePct: number,
    adRatePct = 0
  ): ListingPriceMetrics {
    const hasRange = group.repricingStrategy.some((r) => amazonPrice >= r.minPrice && amazonPrice <= r.maxPrice);
    if (!hasRange) {
      this.logger.warn(
        `No price range found for price ${amazonPrice} in group ${group.id}. Using fallback calculation.`
      );
    }
    return calculateListingPrice(amazonPrice, group.repricingStrategy, group.fees, amazonTaxRatePct, adRatePct);
  }
}
