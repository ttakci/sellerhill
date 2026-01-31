import { logout, setCredentials } from '@/features/auth/store/authSlice';
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { generateRequestId } from '@repo/shared';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  prepareHeaders: (headers, { getState, endpoint }) => {
    // Generate and attach X-Request-ID header for tracking
    const requestId = generateRequestId();
    headers.set('X-Request-ID', requestId);

    // Store request ID in session storage for debugging (dev only)
    if (import.meta.env.DEV) {
      sessionStorage.setItem('lastRequestId', requestId);
    }

    // List of endpoints that don't require authorization
    const publicEndpoints = ['login', 'register', 'verifyEmail', 'resendVerification'];

    // Add auth token if available from state or localStorage as fallback
    // But skip it for public endpoints
    if (!publicEndpoints.includes(endpoint || '')) {
      const state = getState() as any;
      const token = state.auth?.accessToken || localStorage.getItem('accessToken');

      if (import.meta.env.DEV) {
        console.log(`[DEBUG] prepareHeaders - endpoint: ${endpoint}, requestId: ${requestId}`);
        if (token) {
          console.log('[DEBUG] prepareHeaders - token source:', state.auth?.accessToken ? 'redux' : 'localStorage');
        }
      }

      if (token) {
        // Use standard Title Case for consistency with backend expectations
        headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (import.meta.env.DEV) {
      console.log(`[DEBUG] prepareHeaders - public endpoint: ${endpoint}, skipping Authorization header`);
    }

    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (import.meta.env.DEV) {
      console.log('[DEBUG] 401 detected, attempting reauth...');
    }

    // try to get a new token
    const refreshToken = (api.getState() as any).auth?.refreshToken;

    if (refreshToken) {
      if (import.meta.env.DEV) {
        console.log('[DEBUG] refreshing token...');
      }

      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] refresh successful, retrying original request');
        }
        // store the new token
        api.dispatch(setCredentials(refreshResult.data as any));
        // retry the initial query
        result = await baseQuery(args, api, extraOptions);
      } else {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] refresh failed, logging out');
        }
        api.dispatch(logout());
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('[DEBUG] no refresh token found, logging out');
      }
      api.dispatch(logout());
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Example',
    'Auth',
    'Ebay',
    'Dashboard',
    'StoreSettings',
    'ListingSettingsGroups',
    'PredefinedTemplates',
    'Profile',
    'Listings',
    'EbayPolicies',
    'Orders',
  ],
  endpoints: () => ({}),
});
