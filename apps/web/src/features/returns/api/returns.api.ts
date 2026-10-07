/**
 * eBay returns — RTK Query endpoints.
 *
 * The list and the counts are read from our own table (filled by the sweep).
 * The detail read is LIVE (one Post-Order call, at the seller's priority) and
 * the three actions are the only writes — each one a documented Post-Order
 * call the API sends once, after checking eBay's own option list.
 */

import {
  ReturnTab,
  type EbayReturnAction,
  type EbayReturnActionResultDto,
  type EbayReturnDetailDto,
  type PaginatedReturnsDto,
  type ReturnBucketCountsDto,
  type ReturnsQueryDto,
} from '@repo/shared';

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
          if (filters.sortBy) {
            params.sortBy = filters.sortBy;
            params.sortOrder = filters.sortOrder ?? 'desc';
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
    /** The stored row plus a live read from eBay (history, shipments, the options eBay lists right now). */
    getReturnDetail: builder.query<EbayReturnDetailDto, string>({
      query: (id) => ({ url: `/returns/${encodeURIComponent(id)}/detail` }),
      providesTags: (_result, _error, id) => [{ type: 'Returns', id }, 'Returns'],
    }),
    /**
     * One in-app action. The API re-reads the return from eBay before sending
     * anything. `provide_label` sends multipart form data (the label file plus
     * carrier and tracking number); the others send no body.
     */
    actOnReturn: builder.mutation<
      EbayReturnActionResultDto,
      { id: string; action: EbayReturnAction; body?: FormData }
    >({
      query: ({ id, action, body }) => ({
        url: `/returns/${encodeURIComponent(id)}/actions/${action}`,
        method: 'POST',
        ...(body ? { body } : {}),
      }),
      invalidatesTags: ['Returns'],
    }),
  }),
});

export const { useGetReturnsQuery, useGetReturnCountsQuery, useGetReturnDetailQuery, useActOnReturnMutation } =
  returnsApi;
