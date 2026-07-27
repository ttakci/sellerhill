import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { generateRequestId } from '@repo/shared';

import { refreshAuthSession } from './authRefreshCoordinator';

/** Minimal auth slice shape used by baseQuery (avoids circular import with store). */
interface AuthSliceState {
  auth: {
    accessToken: string | null;
  };
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  // Required so the browser sends/receives the HttpOnly refresh cookie
  credentials: 'include',
  prepareHeaders: (headers, { getState, endpoint }) => {
    const requestId = generateRequestId();
    headers.set('X-Request-ID', requestId);

    const publicEndpoints = [
      'login',
      'register',
      'verifyEmail',
      'resendVerification',
      'refresh',
      'logout',
    ];
    if (!publicEndpoints.includes(endpoint || '')) {
      const state = getState() as AuthSliceState;
      const token = state.auth?.accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    // Don't retry refresh/login endpoints
    if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/logout')) {
      return result;
    }

    const refreshed = await refreshAuthSession();
    if (refreshed.success) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Ebay',
    'Dashboard',
    'StoreSettings',
    'ListingSettingsGroups',
    'PredefinedTemplates',
    'Profile',
    'Listings',
    'EbayPolicies',
    'Amazon',
    'Orders',
    'Assistant',
    'Support',
    'Admin',
  ],
  endpoints: () => ({}),
});
