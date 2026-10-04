import type { ListingRulesConfig } from '../store-settings/listing-rules';

/**
 * Template Type
 */
export enum TemplateType {
  CUSTOM = 'custom',
  PREDEFINED = 'predefined',
}

/**
 * Price Range for Repricing Strategy
 */
export interface PriceRange {
  id: string;
  minPrice: number;
  maxPrice: number;
  profitMarginPercent?: number;
  fixedProfitAmount?: number;
}

/**
 * Stock Configuration
 */
export interface StockConfig {
  defaultQuantity: number;
  stockBuffer?: number;
}

/**
 * Fee Configuration
 */
export interface FeeConfig {
  ebayFeePercent: number;
  fixedFeeAmount: number;
  /**
   * Price-ending rounding ("charm pricing"). Lives in the `fees` JSONB so a
   * group saved before the feature simply reads as off.
   */
  priceRoundingEnabled?: boolean;
  /**
   * The cents every calculated price must end in (0–99; 99 → $x.99). The price
   * is always rounded UP to the next amount with this ending, so the seller's
   * target profit is never cut.
   */
  priceEndingCents?: number;
}

export const DEFAULT_PRICE_ENDING_CENTS = 99;

/**
 * Template Configuration
 */
export interface TemplateConfig {
  type: TemplateType;
  customTemplateHtml?: string;
  predefinedTemplateId?: string;
}

/**
 * Listing content policy (title/description pipeline at create time).
 * AI flags are scaffold only until CONTENT_AI_API_KEY is wired.
 */
export interface ListingContentConfig {
  /** Remove brand token from Amazon title before eBay list. */
  stripBrandFromTitle: boolean;
  /** Scaffold: rewrite title via AI when provider is configured. */
  aiTitleEnabled: boolean;
  /** Scaffold: rewrite description via AI when provider is configured. */
  aiDescriptionEnabled: boolean;
}

export const DEFAULT_LISTING_CONTENT_CONFIG: ListingContentConfig = {
  stripBrandFromTitle: false,
  aiTitleEnabled: false,
  aiDescriptionEnabled: false,
};

/**
 * Listing Settings Group Domain Interface
 */
export interface ListingSettingsGroup {
  id: string;
  name: string;
  description?: string;

  // Repricing Strategy
  repricingStrategy: PriceRange[];

  // Stock
  stock: StockConfig;

  // Fees
  fees: FeeConfig;

  // Templates
  templates: TemplateConfig;

  /** Title/description content policy */
  content: ListingContentConfig;

  /**
   * What this group refuses to list and when it ends a listing (VeRO, hide
   * brand, price range, Amazon-shipped, rating / review minimums, clean-up).
   * Always normalized (`normalizeListingRules`): a group that never saved
   * rules reads the defaults — VeRO on, brand hidden.
   */
  listingRules: ListingRulesConfig;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * Predefined Template
 *
 * Seeded catalog rows, owned by the database (migrations `070`/`071`) rather
 * than by application code. `slug` is the stable natural key: `id` is a random
 * UUID referenced from `listing_settings_groups.templates->>'predefinedTemplateId'`
 * with no foreign key, so a catalog update must address rows by slug and leave
 * the id untouched or every group's template choice silently detaches.
 */
export interface PredefinedTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  htmlContent: string;
  /**
   * Preview-only render context. Array values are real — `feature_bullets`,
   * `product_details` and `images` are lists, and the template renderer treats
   * them differently from scalars.
   */
  sampleData: Record<string, string | string[]>;
  previewImage?: string;
  createdAt: Date;
}
