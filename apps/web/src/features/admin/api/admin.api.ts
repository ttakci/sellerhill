import type {
  AdminBillingMetricsDto,
  AdminOperationsSummaryDto,
  AdminOverviewDto,
  ProviderCostSummaryDto,
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
  }),
});

export const {
  useGetAdminOverviewQuery,
  useGetAdminOperationsQuery,
  useGetAdminProviderCostsQuery,
  useGetAdminUserCostsQuery,
  useGetAdminBillingMetricsQuery,
} = adminApi;
