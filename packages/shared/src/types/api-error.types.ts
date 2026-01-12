/**
 * Standardized API Error Response
 * This is the error format returned by the backend
 */
export interface ApiErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string | null;
  errorCode?: string; // i18n translation key
  details?: unknown; // Additional context for translation (e.g., { minLength: 3 })
  requestId?: string; // Request correlation ID
}

/**
 * RTK Query Error Type
 * Wrapper for API errors in RTK Query
 */
export interface RtkQueryError {
  status: number;
  data: ApiErrorResponse;
}
