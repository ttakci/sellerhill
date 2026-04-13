import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { FeeConfig, ListingSettingsGroup, ProductData, StoreSettingsResponse } from '@repo/shared';
import { TemplateType } from '@repo/shared';

import { sanitizeHtml, sanitizeStringArray } from '../../common/utils/sanitize';
import { ListingSettingsGroupService } from '../listing-settings-groups/listing-settings-group.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

@Injectable()
export class ListingStrategyService {
  private readonly logger = new Logger(ListingStrategyService.name);

  constructor(
    private readonly settingsGroupService: ListingSettingsGroupService,
    private readonly storeSettingsService: StoreSettingsService
  ) {}

  /**
   * Calculate final price and stock based on product data and settings group
   */
  async prepareListingData(
    userId: string,
    product: ProductData,
    settingsGroupId: string,
    storeId: string | null = null
  ) {
    const group = await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId);
    const storeSettings = await this.storeSettingsService.getResolvedSettings(userId, storeId);

    const description = this.processDescriptionTemplate(product, group);

    // Validate listing against store settings (Blacklist, etc.)
    this.validateListing(product.title, description, storeSettings);

    const priceMetrics = this.calculatePrice(product.price.current, group);

    // Stock Logic: Subtract buffer from Amazon stock, cap at user's max listing quantity.
    // e.g. defaultQuantity=3, buffer=5:
    //   Amazon=25 → min(max(25-5,0),3)=3  |  Amazon=7 → min(max(7-5,0),3)=2
    //   Amazon=6 → min(max(6-5,0),3)=1    |  Amazon=5 → min(max(5-5,0),3)=0 (out of stock)
    const defaultQuantity = group.stock?.defaultQuantity || 1;
    const stockBuffer = group.stock?.stockBuffer ?? 0;
    const amazonStock = product.stock ?? 0;
    const quantity = Math.min(Math.max(amazonStock - stockBuffer, 0), defaultQuantity);

    this.logger.debug(
      `Stock calculation for ${product.asin || 'product'}: ` +
        `Amazon stock=${amazonStock}, Buffer=${stockBuffer}, ` +
        `Available=${Math.max(amazonStock - stockBuffer, 0)}, Max listing qty=${defaultQuantity}, ` +
        `Final quantity=${quantity} (${quantity === 0 ? 'OUT OF STOCK' : 'IN STOCK'})`
    );

    return {
      title: product.title,
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
      // Location data from Store Settings
      country: storeSettings.country || 'US',
      postalCode: storeSettings.zipCode,
      location: storeSettings.state, // Using state as location, or could be city+state
    };
  }

  /**
   * Validate listing data against store settings (Blacklist, Length, etc.)
   */
  private validateListing(title: string, description: string, settings: StoreSettingsResponse): void {
    const { validateTitle, validateDescription, blacklist } = settings;

    // 3. Blacklist Validation Logic (merged into scope checks)
    const validateBlacklist = (text: string, scope: 'title' | 'description') => {
      if (!blacklist || blacklist.length === 0) {return;}

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
   * Process description using template from settings group
   */
  private processDescriptionTemplate(product: ProductData, group: ListingSettingsGroup): string {
    let template = '{{description}}'; // Default

    // Use custom template if available
    if (group.templates?.type === TemplateType.CUSTOM && group.templates.customTemplateHtml) {
      template = group.templates.customTemplateHtml;
    }
    // TODO: Handle predefined templates if needed

    // Replace variables with sanitized content
    const finalDescription = template
      .replace(/{{title}}/g, sanitizeHtml(product.title))
      .replace(/{{description}}/g, sanitizeHtml(product.description || ''))
      .replace(/{{brand}}/g, sanitizeHtml(product.brand || ''))
      .replace(/{{features}}/g, sanitizeStringArray(product.features || []).join('</li><li>'));

    return finalDescription;
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
