// Domain - Common
export { EMPTY_STRING } from './domain/common/common.constants';

// Utilities
export { generateRequestId, getRequestIdFromHeaders, isValidRequestId } from './utils/requestId';

// Domain - Auth
export * from './domain/auth/index';

// Domain - eBay
export * from './domain/ebay/index';

// Domain - Example
export { EXAMPLE_STATUS } from './domain/example/example.constants';
export type { ExampleStatus } from './domain/example/example.constants';
export type {
    CreateExampleRequest,
    CreateExampleResponse, DeleteExampleRequest,
    DeleteExampleResponse,
    ExampleItem, GetExamplesRequest,
    GetExamplesResponse, PaginationMeta, UpdateExampleRequest,
    UpdateExampleResponse
} from './domain/example/example.dto';
export type { ExampleAggregate, ExampleEntity } from './domain/example/example.types';

// API Validation Schemas (Backend)
export {
    createExampleRequestSchema, exampleItemSchema, getExamplesRequestSchema,
    getExamplesResponseSchema, updateExampleRequestSchema
} from './domain/example/example.validators';

// Domain: Common
export { commonValidators, errorDTOSchema } from './domain/common/common.validators';
export type { ErrorDTO } from './domain/common/error.dto';

// API Error Types
export type { ApiErrorResponse, RtkQueryError } from './types/api-error.types';

// Form Schemas (Frontend - Web/Mobile)
export {
    createExampleFormDataSchema, listExamplesFilterDataSchema, updateExampleFormDataSchema
} from './schemas/example/index';
export type { CreateExampleFormData, ListExamplesFilterData, UpdateExampleFormData } from './schemas/example/index';

// Auth Schemas
export * from './schemas/auth/index';

export { createDomainValidators, createFormValidators } from './schemas/common/form.utils';

// i18n Resources (Frontend - Web/Mobile)
export { SUPPORTED_LANGUAGES, enTranslations, trTranslations } from './i18n/index';
export type { LanguageConfig, SupportedLanguage, TranslationKeys } from './i18n/index';

