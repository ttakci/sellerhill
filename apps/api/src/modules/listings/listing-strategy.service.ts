import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ListingSettingsGroup, ProductData, StoreSettingsResponse } from '@repo/shared';
import { ListingSettingsGroupService } from '../listing-settings-groups/listing-settings-group.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

@Injectable()
export class ListingStrategyService {
  private readonly logger = new Logger(ListingStrategyService.name);

  constructor(
    private readonly settingsGroupService: ListingSettingsGroupService,
    private readonly storeSettingsService: StoreSettingsService,
  ) {}

  /**
   * Calculate final price and stock based on product data and settings group
   */
  async prepareListingData(
    userId: string,
    product: ProductData,
    settingsGroupId: string,
    storeId: string | null = null,
  ) {
    const group = await this.settingsGroupService.getListingSettingsGroupById(userId, settingsGroupId);
    const storeSettings = await this.storeSettingsService.getResolvedSettings(userId, storeId);
    
    const description = this.processDescriptionTemplate(product, group);
    
    // Validate listing against store settings (Blacklist, etc.)
    this.validateListing(product.title, description, storeSettings);

    const price = this.calculatePrice(product.price.current, group);
    // Use stock from settings group or default to 1
    const quantity = group.stock?.defaultQuantity || 1;

    return {
      title: product.title,
      description,
      price,
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
        if (!blacklist || blacklist.length === 0) return;
        
        for (const item of blacklist) {
            const keyword = item.keyword.toLowerCase();
            // Check if item applies to this scope
            if (item.scope === scope || item.scope === 'both') {
                if (text.toLowerCase().includes(keyword)) {
                    throw new BadRequestException(`${scope.charAt(0).toUpperCase() + scope.slice(1)} contains blacklisted keyword: ${item.keyword}`);
                }
            }
        }
    }

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
    if (group.templates?.type === 'custom' && group.templates.customTemplateHtml) {
      template = group.templates.customTemplateHtml;
    } 
    // TODO: Handle predefined templates if needed

    // Replace variables
    let finalDescription = template
      .replace(/{{title}}/g, product.title)
      .replace(/{{description}}/g, product.description || '')
      .replace(/{{brand}}/g, product.brand || '')
      .replace(/{{features}}/g, (product.features || []).join('</li><li>')); // Simple list format
      
    return finalDescription;
  }

  /**
   * Calculate final eBay price based on Amazon price and repricing strategy
   */
  private calculatePrice(amazonPrice: number, group: ListingSettingsGroup): number {
    const { repricingStrategy, fees } = group;

    // 1. Find the applicable price range
    const range = repricingStrategy.find(
      (r) => amazonPrice >= r.minPrice && amazonPrice <= r.maxPrice
    );

    if (!range) {
      this.logger.warn(`No price range found for price ${amazonPrice} in group ${group.id}. Using fallback calculation.`);
      // Fallback: use the last range or just a default 20% margin
      const defaultMargin = 0.20;
      return this.applyFees(amazonPrice * (1 + defaultMargin), fees);
    }

    // 2. Apply profit margin
    let targetPrice = amazonPrice;
    if (range.profitMarginPercent) {
      targetPrice *= (1 + range.profitMarginPercent / 100);
    }
    if (range.fixedProfitAmount) {
      targetPrice += range.fixedProfitAmount;
    }

    // 3. Apply eBay fees
    return this.applyFees(targetPrice, fees);
  }

  /**
   * Add eBay fees and taxes to the target price
   */
  private applyFees(price: number, fees: any): number {
    const { ebayFeePercent, fixedFeeAmount, taxPercent } = fees;
    
    let finalPrice = price;
    
    // Add fixed fee
    finalPrice += (fixedFeeAmount || 0);
    
    // Add eBay fee percent
    if (ebayFeePercent) {
      finalPrice *= (1 + ebayFeePercent / 100);
    }
    
    // Add tax
    if (taxPercent) {
      finalPrice *= (1 + taxPercent / 100);
    }

    // Round to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
  }
}
