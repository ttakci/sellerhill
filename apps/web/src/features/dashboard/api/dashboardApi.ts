/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardChartGranularity, DashboardDataDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export interface GetDashboardArgs {
  /** Chart bucket size — day (30d) | week (12w) | month (12m). */
  chartGranularity?: DashboardChartGranularity;
  ebayAccountId?: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, GetDashboardArgs | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        if (args?.chartGranularity) {
          params.chartGranularity = args.chartGranularity;
        }
        if (args?.ebayAccountId) {
          params.ebayAccountId = args.ebayAccountId;
        }
        return {
          url: '/dashboard',
          method: 'GET',
          params: Object.keys(params).length ? params : undefined,
        };
      },
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
