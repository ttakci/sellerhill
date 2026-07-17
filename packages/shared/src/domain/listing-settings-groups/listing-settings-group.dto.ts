import {
  FeeConfig,
  ListingContentConfig,
  ListingSettingsGroup,
  PredefinedTemplate,
  PriceRange,
  StockConfig,
  TemplateConfig,
} from './listing-settings-group.types';

/**
 * Request DTO for creating Listing Settings Group
 */
export interface CreateListingSettingsGroupRequest {
  name: string;
  description?: string;
  repricingStrategy: Omit<PriceRange, 'id'>[];
  stock: StockConfig;
  fees: FeeConfig;
  templates: TemplateConfig;
  content?: ListingContentConfig;
}

/**
 * Request DTO for updating Listing Settings Group
 */
export interface UpdateListingSettingsGroupRequest {
  name?: string;
  description?: string;
  repricingStrategy?: Omit<PriceRange, 'id'>[];
  stock?: StockConfig;
  fees?: FeeConfig;
  templates?: TemplateConfig;
  content?: ListingContentConfig;
}

/**
 * Response DTO for Listing Settings Group
 */
export interface ListingSettingsGroupResponse extends ListingSettingsGroup {}

/**
 * Response DTO for Predefined Template
 */
export interface PredefinedTemplateResponse extends PredefinedTemplate {}
