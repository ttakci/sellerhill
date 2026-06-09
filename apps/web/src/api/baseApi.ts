import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { generateRequestId } from '@repo/shared';

import { logout, setCredentials } from '@/features/auth/store/authSlice';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  prepareHeaders: (headers, { getState, endpoint }) => {
    const requestId = generateRequestId();
    headers.set('X-Request-ID', requestId);

    const publicEndpoints = ['login', 'register', 'verifyEmail', 'resendVerification'];
    if (!publicEndpoints.includes(endpoint || '')) {
      const state = getState() as any;
      const token = state.auth?.accessToken || localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, any, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const refreshToken = (api.getState() as any).auth?.refreshToken;

    if (refreshToken) {
      const refreshResult = await baseQuery(
        { url: '/auth/refresh', method: 'POST', body: { refreshToken } },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        api.dispatch(setCredentials(refreshResult.data as any));
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logout());
      }
    } else {
      api.dispatch(logout());
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
  ],
  endpoints: () => ({}),
});
