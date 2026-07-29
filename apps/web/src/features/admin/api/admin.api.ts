import type {
  AdminBillingMetricsDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  AdminProxyDto,
  AdminProxyListDto,
  AdminUsersListDto,
  CreateProxyRequest,
  PlatformSettingsListDto,
  ProviderCostSummaryDto,
  UpdateProxyRequest,
  UserCostSummaryDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query<AdminOverviewDto, void>({
      query: () => '/admin/overview',
      providesTags: ['Admin'],
    }),
    getAdminOperations: builder.query<AdminOperationsSummaryDto, void>({
      query: () => '/admin/operations/summary',
      providesTags: ['Admin'],
    }),
    getAdminProviderCosts: builder.query<ProviderCostSummaryDto[], void>({
      query: () => '/admin/finops/providers',
      providesTags: ['Admin'],
    }),
    getAdminUserCosts: builder.query<UserCostSummaryDto[], void>({
      query: () => '/admin/finops/users',
      providesTags: ['Admin'],
    }),
    getAdminBillingMetrics: builder.query<AdminBillingMetricsDto, void>({
      query: () => '/admin/billing/metrics',
      providesTags: ['Admin'],
    }),
    getAdminProxies: builder.query<AdminProxyListDto, void>({
      query: () => '/admin/proxies',
      providesTags: ['Admin'],
    }),
    createAdminProxy: builder.mutation<AdminProxyDto, CreateProxyRequest>({
      query: (body) => ({ url: '/admin/proxies', method: 'POST', body }),
      invalidatesTags: ['Admin'],
    }),
    updateAdminProxy: builder.mutation<AdminProxyDto, { id: string } & UpdateProxyRequest>({
      query: ({ id, ...body }) => ({ url: `/admin/proxies/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Admin'],
    }),
    getAdminUsers: builder.query<AdminUsersListDto, void>({
      query: () => '/admin/users',
      providesTags: ['Admin'],
    }),
    getAdminSettings: builder.query<PlatformSettingsListDto, void>({
      query: () => '/admin/settings',
      providesTags: ['Admin'],
    }),
    // The mutations return the full refreshed list, so the reducer swaps it in
    // directly instead of forcing a second round-trip through invalidation.
    updateAdminSetting: builder.mutation<PlatformSettingsListDto, { key: string; value: string }>({
      query: ({ key, value }) => ({
        url: `/admin/settings/${encodeURIComponent(key)}`,
        method: 'PUT',
        body: { value },
      }),
      invalidatesTags: ['Admin'],
    }),
    resetAdminSetting: builder.mutation<PlatformSettingsListDto, string>({
      query: (key) => ({ url: `/admin/settings/${encodeURIComponent(key)}`, method: 'DELETE' }),
      invalidatesTags: ['Admin'],
    }),
    testAdminEmailSettings: builder.mutation<{ ok: boolean; error: string | null }, void>({
      query: () => ({ url: '/admin/settings/email/test', method: 'POST' }),
    }),
  }),
});

export const {
  useGetAdminOverviewQuery,
  useGetAdminOperationsQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminUserCostsQuery,
  useGetAdminBillingMetricsQuery,
  useGetAdminProxiesQuery,
  useCreateAdminProxyMutation,
  useUpdateAdminProxyMutation,
  useGetAdminUsersQuery,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingMutation,
  useResetAdminSettingMutation,
  useTestAdminEmailSettingsMutation,
} = adminApi;
