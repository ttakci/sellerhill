// Domain - Common
export {
  DEFAULT_LOCALE,
  EMPTY_STRING,
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  isValidLocale,
} from './domain/common/common.constants';
export type { SupportedLocale } from './domain/common/common.constants';

// Utilities
export { generateRequestId, getRequestIdFromHeaders, isValidRequestId } from './utils/requestId';

// Domain - User
export * from './domain/user/user.types';

// Domain - Auth
export * from './domain/auth/index';

// Domain - eBay
export * from './domain/ebay/index';

// Domain - Store Settings
export * from './domain/store-settings/index';

// Domain - Listing Settings Groups
export * from './domain/listing-settings-groups/index';

// Domain - Listings
export * from './domain/listings/index';

// Domain - Products
export * from './domain/products/index';

// Domain - Keepa
export * from './domain/keepa/index';

// Domain - Orders
export * from './domain/orders/index';

// Domain - Dashboard
export * from './domain/dashboard/index';

// Domain - Amazon
export * from './domain/amazon/index';

// Domain - LLM
export * from './domain/llm/index';

// Domain - Admin (Observability)
export * from './domain/admin/index';

// Domain - Queue correlation
export * from './domain/queue/index';

// Domain - FinOps (Pricing & Cost Attribution)
export * from './domain/finops/index';

// Domain - Billing (Subscription Plans & Usage Limits)
export * from './domain/billing/index';

// Domain - Assistant, Support, Knowledge
export * from './domain/assistant/index';
export * from './domain/support/index';
export * from './domain/knowledge/index';

// API Error Types
export type { ApiErrorResponse, RtkQueryError } from './types/api-error.types';

// Domain: Common
export { commonValidators, errorDTOSchema } from './domain/common/common.validators';
export type { ErrorDTO } from './domain/common/error.dto';

// Store Settings Schemas
export * from './schemas/store-settings/storeSettings.schema';

// Listing Settings Groups Schemas
export * from './schemas/listing-settings-groups/index';

// Auth Schemas
export * from './schemas/auth/index';

export { createDomainValidators, createFormValidators } from './schemas/common/form.utils';

// Domain - Profile
export * from './domain/profile/index';

// i18n Resources (Frontend - Web/Mobile)
export * from './i18n/index';
export type { LanguageConfig, SupportedLanguage, TranslationKeys } from './i18n/index';

// Profile Schemas
export * from './schemas/profile/index';

// Listings Schemas
export * from './schemas/listings/index';

// Orders Schemas
export * from './schemas/orders/index';

// Amazon Schemas
export * from './schemas/amazon/index';

// Billing Schemas
export * from './schemas/billing/index';

// Assistant, Support, Knowledge Schemas
export * from './schemas/assistant/index';
export * from './schemas/support/index';
export * from './schemas/knowledge/index';
