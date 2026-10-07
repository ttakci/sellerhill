/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardDataDto, DashboardRangeInput } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export interface GetDashboardArgs {
  /** A preset (`?range=`) or a custom window (`?from&to`), on the seller's calendar day. */
  range: DashboardRangeInput;
  ebayAccountId?: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, GetDashboardArgs>({
      query: ({ range, ebayAccountId }) => {
        const params: Record<string, string> =
          'preset' in range ? { range: range.preset } : { from: range.from, to: range.to };
        if (ebayAccountId) {
          params.ebayAccountId = ebayAccountId;
        }
        return { url: '/dashboard', method: 'GET', params };
      },
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
