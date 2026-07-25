import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  TemplateType,
  type FeeConfig,
  type ListingSettingsGroup,
  type ProductData,
  type StoreSettingsResponse,
} from '@repo/shared';

import { sanitizeHtml, sanitizeStringArray } from '../../common/utils/sanitize';
import { ListingSettingsGroupService } from '../listing-settings-groups/listing-settings-group.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import { ContentGenerationService } from './content-generation.service';

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
    let description = this.processDescriptionTemplate(product, group);

    const applyAi = Boolean(options?.applyContentAi);
    const wantAiTitle = applyAi && Boolean(group.content?.aiTitleEnabled);
    const wantAiDescription = applyAi && Boolean(group.content?.aiDescriptionEnabled);
    if ((wantAiTitle || wantAiDescription) && this.contentGeneration.isEnabled()) {
      const base = { product, baseTitle: title, baseDescription: description };
      if (wantAiTitle) {
        title = await this.contentGeneration.rewriteTitle(base);
      }
      if (wantAiDescription) {
        description = await this.contentGeneration.rewriteDescription({
          ...base,
          baseTitle: title,
        });
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
    let title = (product.title || '').trim();
    if (group.content?.stripBrandFromTitle && product.brand) {
      title = this.stripBrandFromTitle(title, product.brand);
    }
    // eBay title max 80 chars
    if (title.length > 80) {
      title = title.slice(0, 80).trim();
    }
    return title || product.asin || 'Product';
  }

  /** Case-insensitive brand strip (whole token / leading brand + separators). */
  private stripBrandFromTitle(title: string, brand: string): string {
    const b = brand.trim();
    if (!b) {
      return title;
    }
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Leading "Brand - " / "Brand:" / "Brand "
    let next = title.replace(new RegExp(`^${escaped}\\s*[-–:|]?\\s*`, 'i'), '');
    // Remaining whole-word brand occurrences
    next = next.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
    return next.replace(/\s{2,}/g, ' ').replace(/^[-–:|,\s]+|[-–:|,\s]+$/g, '').trim() || title;
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

    // 2. Description Validation
    if (validateDescription) {
      if (!description || description.trim().length === 0) {
        throw new BadRequestException('Listing description cannot be empty');
      }
      validateBlacklist(description, 'description');
    }
  }

  /**
   * Process description using template from settings group.
   * When Keepa description is empty, fall back to features as an HTML list.
   */
  private processDescriptionTemplate(product: ProductData, group: ListingSettingsGroup): string {
    let template = '{{description}}'; // Default

    // Use custom template if available
    if (group.templates?.type === TemplateType.CUSTOM && group.templates.customTemplateHtml) {
      template = group.templates.customTemplateHtml;
    }
    // TODO: Handle predefined templates if needed

    const features = sanitizeStringArray(product.features || []);
    const rawDescription = (product.description || '').trim();
    const descriptionBody =
      rawDescription ||
      (features.length > 0
        ? `<ul><li>${features.join('</li><li>')}</li></ul>`
        : '');

    // Replace variables with sanitized content
    const finalDescription = template
      .replace(/{{title}}/g, sanitizeHtml(product.title))
      .replace(/{{description}}/g, rawDescription ? sanitizeHtml(rawDescription) : descriptionBody)
      .replace(/{{brand}}/g, sanitizeHtml(product.brand || ''))
      .replace(/{{features}}/g, features.join('</li><li>'));

    // If template only had empty description and no features placeholders, still return features fallback
    if (!finalDescription.trim() && features.length > 0) {
      return `<ul><li>${features.join('</li><li>')}</li></ul>`;
    }

    return finalDescription;
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
