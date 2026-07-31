import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_LISTING_TEMPLATE_HTML,
  EBAY_DESCRIPTION_MAX_LENGTH,
  EBAY_TITLE_MAX_LENGTH,
  TemplateType,
  buildListingTemplateContext,
  renderListingTemplate,
  type FeeConfig,
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
    this.validateListing(title, description, storeSettings);

    const priceMetrics = this.calculatePrice(product.price.current, group);

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
      // Location data from Store Settings
      country: storeSettings.country || 'US',
      postalCode: storeSettings.zipCode,
      location: storeSettings.state, // Using state as location, or could be city+state
    };
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
  private validateListing(title: string, description: string, settings: StoreSettingsResponse): void {
    const { validateTitle, validateDescription, blacklist } = settings;

    // 3. Blacklist Validation Logic (merged into scope checks)
    const validateBlacklist = (text: string, scope: 'title' | 'description') => {
      if (!blacklist || blacklist.length === 0) {
        return;
      }

      for (const item of blacklist) {
        const keyword = item.keyword.toLowerCase();
        // Check if item applies to this scope
        if (item.scope === scope || item.scope === 'both') {
          if (text.toLowerCase().includes(keyword)) {
            throw new BadRequestException(
              `${scope.charAt(0).toUpperCase() + scope.slice(1)} contains blacklisted keyword: ${item.keyword}`
            );
          }
        }
      }
    };

    // 1. Title Validation
    if (validateTitle) {
      if (!title || title.trim().length === 0) {
        throw new BadRequestException('Listing title cannot be empty');
      }
      validateBlacklist(title, 'title');
    }

    // 2. Description Validation — the blacklist runs against buyer-VISIBLE text.
    // The rendered description embeds Amazon-hosted image URLs
    // (images-na.ssl-images-amazon.com), so scanning raw markup made the
    // obvious "amazon" keyword reject every listing over an `<img src>` no
    // buyer ever reads.
    if (validateDescription) {
      if (!description || description.trim().length === 0) {
        throw new BadRequestException('Listing description cannot be empty');
      }
      validateBlacklist(extractVisibleText(description), 'description');
    }
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
   * Calculate final eBay price based on Amazon price and repricing strategy
   */
  private calculatePrice(
    amazonPrice: number,
    group: ListingSettingsGroup
  ): {
    finalPrice: number;
    purchasePrice: number;
    estimatedProfit: number;
    profitMargin: number;
    roi: number;
  } {
    const { repricingStrategy, fees } = group;

    // 1. Find the applicable price range
    const range = repricingStrategy.find((r) => amazonPrice >= r.minPrice && amazonPrice <= r.maxPrice);

    let netTarget = amazonPrice;

    if (!range) {
      this.logger.warn(
        `No price range found for price ${amazonPrice} in group ${group.id}. Using fallback calculation.`
      );
      // Fallback: use a default 20% margin
      const defaultMargin = 0.2;
      netTarget = amazonPrice * (1 + defaultMargin);
    } else {
      // 2. Apply profit margin
      if (range.profitMarginPercent) {
        netTarget *= 1 + range.profitMarginPercent / 100;
      }
      if (range.fixedProfitAmount) {
        netTarget += range.fixedProfitAmount;
      }
    }

    // 3. Apply eBay fees
    let finalPrice = this.applyFees(netTarget, fees);

    // 3.5. Enforce minimum price (eBay requirement: typically $0.99 for USD)
    const minPrice = 0.99;
    if (finalPrice < minPrice) {
      this.logger.log(`Calculated price ${finalPrice} is below minimum. Adjusting to ${minPrice}.`);
      finalPrice = minPrice;
    }

    // 4. Calculate metrics
    const estimatedProfit = netTarget - amazonPrice;
    const profitMargin = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;
    const roi = amazonPrice > 0 ? (estimatedProfit / amazonPrice) * 100 : 0;

    return {
      finalPrice,
      purchasePrice: amazonPrice,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      roi: Math.round(roi * 100) / 100,
    };
  }

  /**
   * Add eBay fees and taxes to the target price using a reverse calculation
   * to ensure the desired profit margin is maintained after all deductions.
   */
  private applyFees(netTarget: number, fees: FeeConfig): number {
    const ebayFeePercent = Number(fees?.ebayFeePercent) || 0;
    const fixedFeeAmount = Number(fees?.fixedFeeAmount) || 0;
    const taxPercent = Number(fees?.taxPercent) || 0;

    // Formula: SalePrice = (NetTarget + FixedFee) / (1 - (EbayFee% + Tax%) / 100)
    // This ensures that when eBay takes its percentage and the fixed fee,
    // we are left with exactly the netTarget.

    const totalPercentageDeduction = (ebayFeePercent + taxPercent) / 100;

    // Guard against division by zero if fees are 100% or more
    if (totalPercentageDeduction >= 1) {
      this.logger.error(
        `Total percentage deduction (${totalPercentageDeduction * 100}%) is 100% or more. Invalid fee config.`
      );
      return netTarget * 1.5; // Fallback
    }

    const finalPrice = (netTarget + fixedFeeAmount) / (1 - totalPercentageDeduction);

    // Round to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
  }
}
