/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardDataDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export interface GetDashboardArgs {
  days?: number;
  ebayAccountId?: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, GetDashboardArgs | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        if (args?.days) {
          params.days = String(args.days);
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
