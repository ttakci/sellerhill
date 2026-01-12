import { SerializedError } from '@reduxjs/toolkit';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiErrorResponse } from '@repo/shared';

/**
 * Type guard for RTK Query fetch errors
 */
export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error && 'data' in error;
}

/**
 * Type guard for serialized errors
 */
export function isSerializedError(error: unknown): error is SerializedError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Extract request ID from error response
 */
export function getRequestIdFromError(error: FetchBaseQueryError | SerializedError | undefined): string | null {
  if (!error) {
    return null;
  }

  if (isFetchBaseQueryError(error) && error.data && typeof error.data === 'object') {
    const apiError = error.data as ApiErrorResponse;
    return apiError.requestId ?? null;
  }

  return null;
}

/**
 * Extract error message from RTK Query error
 * Returns i18n key if available, otherwise fallback message
 *
 * @param error - The error from RTK Query mutation/query
 * @param fallback - Default i18n key if no errorCode is found
 * @returns Object with i18n key and optional params for interpolation
 *
 * Note: Request ID is automatically logged to console in dev mode
 * and sent to error tracking systems (Sentry, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   await createExample(data).unwrap();
 * } catch (error) {
 *   const { key, params } = getErrorMessage(error as any);
 *   toast.error(t(key, params));
 * }
 * ```
 */
export function getErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
  fallback = 'error.serverError'
): { key: string; params?: Record<string, string | number> } {
  if (!error) {
    return { key: fallback };
  }

  // Log request ID to console for debugging (dev only)
  if (import.meta.env.DEV) {
    const requestId = getRequestIdFromError(error);
    if (requestId) {
      // eslint-disable-next-line no-console
      console.info(`[Error] Request ID: ${requestId}`);
    }
  }

  if (isFetchBaseQueryError(error) && error.data) {
    const apiError = error.data as ApiErrorResponse;

    // errorCode varsa (backend i18n key göndermiş)
    if (apiError.errorCode) {
      return {
        key: apiError.errorCode,
        params: apiError.details as Record<string, string | number>,
      };
    }

    // errorCode yoksa backend message'ı fallback olarak kullan
    const message = Array.isArray(apiError.message) ? apiError.message.join(', ') : apiError.message;
    return {
      key: fallback,
      params: { message },
    };
  }

  if (isSerializedError(error)) {
    return {
      key: fallback,
      params: { message: error.message || 'Unknown error' },
    };
  }

  return { key: fallback };
}
