import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
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
import type { StrategyCommerce } from './listing-pricing.helpers';
import {
  normalizeTitleWhitespace,
  stripBrandFromTitle,
  truncateTitleAtWordBoundary,
} from './listing-title';

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
   */
  async prepareListingData(
    userId: string,
    product: ProductData,
    settingsGroupId: string,
    storeId: string | null = null,
    options?: { applyContentAi?: boolean }
  ) {
    const group = await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId);
    const storeSettings = await this.storeSettingsService.getResolvedSettings(userId, storeId);

    let title = this.buildListingTitle(product, group);
    let description = await this.processDescriptionTemplate(product, group);

    const applyAi = Boolean(options?.applyContentAi);
    const wantAiTitle = applyAi && Boolean(group.content?.aiTitleEnabled);
    const wantAiDescription = applyAi && Boolean(group.content?.aiDescriptionEnabled);
    if ((wantAiTitle || wantAiDescription) && (await this.contentGeneration.isEnabled())) {
      const base = {
        product,
        baseTitle: title,
        baseDescription: description,
        stripBrand: Boolean(group.content?.stripBrandFromTitle),
      };
      if (wantAiTitle) {
        // Model output is untrusted for length/whitespace as much as for content.
        title = truncateTitleAtWordBoundary(
          normalizeTitleWhitespace(await this.contentGeneration.rewriteTitle(base)),
          EBAY_TITLE_MAX_LENGTH
        );
      }
      if (wantAiDescription) {
        const aiDescription = await this.contentGeneration.rewriteDescription({
          ...base,
          baseTitle: title,
        });
        description = truncateHtml(sanitizeListingHtml(aiDescription), EBAY_DESCRIPTION_MAX_LENGTH);
      }
    } else if (applyAi && (group.content?.aiTitleEnabled || group.content?.aiDescriptionEnabled)) {
      this.logger.debug(
        `Content AI flags on for group but LLM_CONTENT_ENABLED is false — using deterministic title/description`
      );
    }

    // Validate listing against store settings (Blacklist, etc.) — after AI so blacklist still applies
    this.validateListing(title, description, product, storeSettings);

    const priceMetrics = this.calculatePrice(
      product.price.current,
      group,
      Number(storeSettings.amazonTaxRate) || 0
    );

    // Stock Logic: Subtract buffer from Amazon stock, cap at user's max listing quantity.
    // See calculateQuantity() for the canonical formula (shared by all stock-compute paths).
    const amazonStock = product.stock ?? 0;
    const quantity = this.calculateQuantity(amazonStock, group);

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
    amazonTaxRatePct = 0
  ): Promise<StrategyCommerce> {
    const resolved =
      group ?? (await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId));

    const priceMetrics = this.calculatePrice(product.price.current, resolved, amazonTaxRatePct);

    return {
      price: priceMetrics.finalPrice,
      quantity: this.calculateQuantity(product.stock ?? 0, resolved),
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
    group: ListingSettingsGroup
  ): string {
    let title = normalizeTitleWhitespace(product.title || '');

    if (group.content?.stripBrandFromTitle && product.brand) {
      title = stripBrandFromTitle(title, product.brand);
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
    settings: StoreSettingsResponse
  ): void {
    const { checkBlacklist, blacklist } = settings;

    const validateBlacklist = (values: string[], type: BlacklistType): void => {
      for (const item of blacklist ?? []) {
        const keyword = item.keyword.trim();
        if (!keyword || !item.types.includes(type)) {
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
      [product.brand ?? '', product.manufacturer ?? ''],
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
  private async processDescriptionTemplate(
    product: ProductData,
    group: ListingSettingsGroup
  ): Promise<string> {
    const template = await this.resolveTemplateHtml(group);

    const features = sanitizeStringArray(product.features || []);
    const description = sanitizeHtml((product.description || '').trim());

    const context = buildListingTemplateContext({
      title: product.title,
      // Amazon descriptions are often empty; the feature bullets are then the
      // only real copy we have and must not be dropped silently.
      description: description || (features.length > 0 ? `<ul><li>${features.join('</li><li>')}</li></ul>` : ''),
      brand: product.brand,
      manufacturer: product.manufacturer,
      asin: product.asin,
      category: product.category,
      features,
      specs: product.specs,
      imageUrls: product.imageUrls,
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
   * quantity = min(max(amazonStock − buffer, 0), defaultQuantity)
   * e.g. defaultQuantity=3, buffer=5:
   *   Amazon=25 → min(max(25-5,0),3)=3  |  Amazon=7 → min(max(7-5,0),3)=2
   *   Amazon=6 → min(max(6-5,0),3)=1    |  Amazon=5 → min(max(5-5,0),3)=0 (out of stock)
   *
   * Single source of truth — used by listing creation, the 12h Keepa sync, and the
   * sale-driven stock-sync queue so every path computes quantity identically.
   */
  calculateQuantity(amazonStock: number, group: Pick<ListingSettingsGroup, 'stock'>): number {
    const defaultQuantity = group.stock?.defaultQuantity || 1;
    const stockBuffer = group.stock?.stockBuffer ?? 0;
    return Math.min(Math.max(amazonStock - stockBuffer, 0), defaultQuantity);
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
  private calculatePrice(amazonPrice: number, group: ListingSettingsGroup, amazonTaxRatePct: number): ListingPriceMetrics {
    const hasRange = group.repricingStrategy.some((r) => amazonPrice >= r.minPrice && amazonPrice <= r.maxPrice);
    if (!hasRange) {
      this.logger.warn(
        `No price range found for price ${amazonPrice} in group ${group.id}. Using fallback calculation.`
      );
    }
    return calculateListingPrice(amazonPrice, group.repricingStrategy, group.fees, amazonTaxRatePct);
  }
}
