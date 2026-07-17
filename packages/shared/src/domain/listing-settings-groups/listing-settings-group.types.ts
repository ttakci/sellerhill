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
  taxPercent: number;
}

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

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * Predefined Template
 */
export interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  htmlContent: string;
  sampleData: Record<string, string>;
  previewImage?: string;
  createdAt: Date;
}
