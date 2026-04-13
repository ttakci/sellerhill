// Domain - Common
export { EMPTY_STRING } from './domain/common/common.constants';

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
