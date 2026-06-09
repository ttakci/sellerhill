import { SerializedError } from '@reduxjs/toolkit';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiErrorResponse } from '@repo/shared';

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error && 'data' in error;
}

export function isSerializedError(error: unknown): error is SerializedError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Extract the i18n key from an RTK Query error.
 * Backend sends keys like "auth.errors.emailNotVerified" in the message field.
 * The first segment is the i18next namespace (e.g. "auth"),
 * the rest is the key path inside that namespace (e.g. "auth.errors.emailNotVerified").
 * Result: "auth:auth.errors.emailNotVerified"
 */
export function getErrorI18nKey(
  error: FetchBaseQueryError | SerializedError | undefined,
  fallback = 'translation:error.serverError'
): string {
  if (!error) {return fallback;}

  if (isFetchBaseQueryError(error) && error.data) {
    const apiError = error.data as ApiErrorResponse;

    if (apiError.errorCode) {return apiError.errorCode;}

    const message = Array.isArray(apiError.message) ? apiError.message.join(', ') : apiError.message;
    if (message?.includes('.')) {
      const dotIndex = message.indexOf('.');
      const ns = message.substring(0, dotIndex);
      return `${ns}:${message}`;
    }

    return fallback;
  }

  return fallback;
}
