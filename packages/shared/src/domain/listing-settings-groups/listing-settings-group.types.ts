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
  autoRestock: boolean;
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
  type: 'custom' | 'predefined';
  customTemplateHtml?: string;
  predefinedTemplateId?: string;
}

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
