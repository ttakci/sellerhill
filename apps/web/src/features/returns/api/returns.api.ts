/**
 * eBay returns — RTK Query endpoints.
 *
 * Read-only on purpose: the page shows what is due and by when, and the seller
 * acts on eBay. There is no approve / refund mutation here.
 */

import { ReturnTab, type PaginatedReturnsDto, type ReturnBucketCountsDto, type ReturnsQueryDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const returnsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReturns: builder.query<PaginatedReturnsDto, ReturnsQueryDto | void>({
      query: (filters) => {
        const params: Record<string, string> = {};
        if (filters) {
          if (filters.page) {
            params.page = String(filters.page);
          }
          if (filters.limit) {
            params.limit = String(filters.limit);
          }
          // "All" is the absence of a tab filter.
          if (filters.tab && filters.tab !== ReturnTab.ALL) {
            params.tab = filters.tab;
          }
          if (filters.ebayAccountId) {
            params.ebayAccountId = filters.ebayAccountId;
          }
          if (filters.search) {
            params.search = filters.search;
          }
        }
        return { url: '/returns', params };
      },
      providesTags: ['Returns'],
    }),
    /** Whole-store bucket counts for the tab rail — scoped by store only, never by tab or search. */
    getReturnCounts: builder.query<ReturnBucketCountsDto, { ebayAccountId?: string } | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        if (args?.ebayAccountId) {
          params.ebayAccountId = args.ebayAccountId;
        }
        return { url: '/returns/counts', params };
      },
      providesTags: ['Returns'],
    }),
  }),
});

export const { useGetReturnsQuery, useGetReturnCountsQuery } = returnsApi;
