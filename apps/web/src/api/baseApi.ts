import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { generateRequestId } from '@repo/shared';

/**
 * Base RTK Query API
 *
 * Purpose:
 * - Central API configuration with v1 versioning
 * - Shared baseQuery with auth interceptors
 * - Global tag types for cache invalidation
 * - Request ID injection for tracking
 *
 * Usage:
 * ```typescript
 * import { baseApi } from '@/api/baseApi';
 *
 * export const exampleApi = baseApi.injectEndpoints({
 *   endpoints: (builder) => ({...})
 * });
 * ```
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
    prepareHeaders: (headers) => {
      // Generate and attach X-Request-ID header for tracking
      const requestId = generateRequestId();
      headers.set('X-Request-ID', requestId);

      // Store request ID in session storage for debugging (dev only)
      if (import.meta.env.DEV) {
        sessionStorage.setItem('lastRequestId', requestId);
      }

      // TODO: Add auth token when authentication is implemented
      // const token = getToken();
      // if (token) {
      //   headers.set('authorization', `Bearer ${token}`);
      // }
      return headers;
    },
  }),
  tagTypes: ['Example'],
  endpoints: () => ({}),
});
