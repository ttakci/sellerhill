/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardDataDto, DashboardRangeInput, TopListingSortKey, TopListingsPageDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export interface GetDashboardArgs {
  /** A preset (`?range=`) or a custom window (`?from&to`), on the seller's calendar day. */
  range: DashboardRangeInput;
  ebayAccountId?: string;
}

export interface GetTopListingsArgs extends GetDashboardArgs {
  sortBy: TopListingSortKey;
  page: number;
  limit: number;
}

const rangeParams = ({ range, ebayAccountId }: GetDashboardArgs): Record<string, string> => {
  const params: Record<string, string> =
    'preset' in range ? { range: range.preset } : { from: range.from, to: range.to };
  if (ebayAccountId) {
    params.ebayAccountId = ebayAccountId;
  }
  return params;
};

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, GetDashboardArgs>({
      query: (args) => ({ url: '/dashboard', method: 'GET', params: rangeParams(args) }),
      providesTags: ['Dashboard'],
    }),
    /** The listings that sold in the range, ranked by `sortBy` (Top sellers tab). */
    getTopListings: builder.query<TopListingsPageDto, GetTopListingsArgs>({
      query: ({ sortBy, page, limit, ...args }) => ({
        url: '/dashboard/top-listings',
        method: 'GET',
        params: { ...rangeParams(args), sortBy, page: String(page), limit: String(limit) },
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery, useGetTopListingsQuery } = dashboardApi;
