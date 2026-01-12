// Domain - Common
export { EMPTY_STRING } from './domain/common/common.constants';

// Utilities
export { generateRequestId, getRequestIdFromHeaders, isValidRequestId } from './utils/requestId';

// Domain - Example
export { EXAMPLE_STATUS } from './domain/example/example.constants';
export type { ExampleStatus } from './domain/example/example.constants';
export type { ExampleEntity, ExampleAggregate } from './domain/example/example.types';
export type {
  CreateExampleRequest,
  CreateExampleResponse,
  UpdateExampleRequest,
  UpdateExampleResponse,
  GetExamplesRequest,
  GetExamplesResponse,
  DeleteExampleRequest,
  DeleteExampleResponse,
  ExampleItem,
  PaginationMeta,
} from './domain/example/example.dto';

// API Validation Schemas (Backend)
export {
  createExampleRequestSchema,
  updateExampleRequestSchema,
  getExamplesRequestSchema,
  getExamplesResponseSchema,
  exampleItemSchema,
} from './domain/example/example.validators';

// Domain: Common
export type { ErrorDTO } from './domain/common/error.dto';
export { errorDTOSchema, commonValidators } from './domain/common/common.validators';

// API Error Types
export type { ApiErrorResponse, RtkQueryError } from './types/api-error.types';

// Form Schemas (Frontend - Web/Mobile)
export {
  createExampleFormDataSchema,
  updateExampleFormDataSchema,
  listExamplesFilterDataSchema,
} from './schemas/example/index';
export type { CreateExampleFormData, UpdateExampleFormData, ListExamplesFilterData } from './schemas/example/index';
export { createFormValidators, createDomainValidators } from './schemas/common/form.utils';

// i18n Resources (Frontend - Web/Mobile)
export { enTranslations, trTranslations, SUPPORTED_LANGUAGES } from './i18n/index';
export type { TranslationKeys, SupportedLanguage, LanguageConfig } from './i18n/index';
