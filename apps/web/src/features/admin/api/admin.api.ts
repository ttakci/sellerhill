import type {
  AdminAspectDefaultDto,
  AdminAspectDefaultsListDto,
  AdminBillingMetricsDto,
  AdminCategoryMappingDto,
  AdminListingFailuresDto,
  AdminListingFailuresQuery,
  AdminListingQualitySummaryDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  AdminProxyDto,
  AdminProxyListDto,
  AdminUsersListDto,
  CreateProxyRequest,
  PlatformSettingsListDto,
  ProviderCostSummaryDto,
  UpdateProxyRequest,
  EbayCallBudgetStatusDto,
  UpsertAspectDefaultRequest,
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
    // eBay meters calls per APPLICATION, so this is one pool shared by every
    // seller — the panel is how an operator watches it drain.
    getAdminEbayBudget: builder.query<EbayCallBudgetStatusDto[], void>({
      query: () => '/admin/ebay/budget',
      providesTags: ['Admin'],
    }),
    // The only surface that carries a provider's raw error text.
    getAdminListingFailures: builder.query<AdminListingFailuresDto, AdminListingFailuresQuery | void>({
      query: (params) => ({ url: '/admin/listing-failures', params: params ?? undefined }),
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
    // Listing quality — how eBay item specifics are being filled, and the
    // operator-curated values that correct a whole category at once.
    getAdminListingQuality: builder.query<AdminListingQualitySummaryDto, number | void>({
      query: (days) => `/admin/listing-quality/summary${days ? `?days=${days}` : ''}`,
      providesTags: ['Admin'],
    }),
    getAdminAspectDefaults: builder.query<AdminAspectDefaultsListDto, { search?: string; page?: number } | void>({
      query: (params) => {
        const search = params && params.search ? `&search=${encodeURIComponent(params.search)}` : '';
        const page = params && params.page ? `&page=${params.page}` : '';
        return `/admin/listing-quality/defaults?limit=25${search}${page}`;
      },
      providesTags: ['Admin'],
    }),
    upsertAdminAspectDefault: builder.mutation<AdminAspectDefaultDto, UpsertAspectDefaultRequest>({
      query: (body) => ({ url: '/admin/listing-quality/defaults', method: 'PUT', body }),
      invalidatesTags: ['Admin'],
    }),
    removeAdminAspectDefault: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/admin/listing-quality/defaults/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Admin'],
    }),
    getAdminCategoryMappings: builder.query<AdminCategoryMappingDto[], void>({
      query: () => '/admin/listing-quality/categories',
      providesTags: ['Admin'],
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
  useGetAdminEbayBudgetQuery,
  useGetAdminListingFailuresQuery,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingMutation,
  useResetAdminSettingMutation,
  useTestAdminEmailSettingsMutation,
  useGetAdminListingQualityQuery,
  useGetAdminAspectDefaultsQuery,
  useUpsertAdminAspectDefaultMutation,
  useRemoveAdminAspectDefaultMutation,
  useGetAdminCategoryMappingsQuery,
} = adminApi;
