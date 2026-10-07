/**
 * eBay cancellation requests — RTK Query endpoints.
 *
 * The list and the counts are read from our own table (filled by the sweep).
 * The detail read is live (one Post-Order call, cached 60 s by the API) and
 * the two answers are the only writes — each one a documented Post-Order call
 * the API sends once, after re-reading the request from eBay.
 */

import {
  CancellationTab,
  type CancellationBucketCountsDto,
  type CancellationsQueryDto,
  type EbayCancellationAction,
  type EbayCancellationActionRequestDto,
  type EbayCancellationActionResultDto,
  type EbayCancellationDetailDto,
  type PaginatedCancellationsDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const cancellationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCancellations: builder.query<PaginatedCancellationsDto, CancellationsQueryDto | void>({
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
          if (filters.tab && filters.tab !== CancellationTab.ALL) {
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
        return { url: '/cancellations', params };
      },
      providesTags: ['Cancellations'],
    }),
    /** Whole-store bucket counts for the tab rail — scoped by store only, never by tab or search. */
    getCancellationCounts: builder.query<CancellationBucketCountsDto, { ebayAccountId?: string } | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        if (args?.ebayAccountId) {
          params.ebayAccountId = args.ebayAccountId;
        }
        return { url: '/cancellations/counts', params };
      },
      providesTags: ['Cancellations'],
    }),
    /** The stored row plus a live read from eBay (history, amounts, whether the answers are still offered). */
    getCancellationDetail: builder.query<EbayCancellationDetailDto, string>({
      query: (id) => ({ url: `/cancellations/${encodeURIComponent(id)}/detail` }),
      providesTags: (_result, _error, id) => [{ type: 'Cancellations', id }, 'Cancellations'],
    }),
    /**
     * Accept (approve) or decline (reject) a buyer's request — one Post-Order write.
     * Refetches the list, the counts and the detail, and the order page's cancellation card.
     */
    actOnCancellation: builder.mutation<
      EbayCancellationActionResultDto,
      { id: string; action: EbayCancellationAction; orderId?: string | null; body?: EbayCancellationActionRequestDto }
    >({
      query: ({ id, action, body }) => ({
        url: `/cancellations/${encodeURIComponent(id)}/actions/${action}`,
        method: 'POST',
        body: body ?? {},
      }),
      invalidatesTags: (_result, _error, { id, orderId }) => [
        { type: 'Cancellations', id },
        'Cancellations',
        ...(orderId ? [{ type: 'Orders' as const, id: orderId }] : []),
        'Orders',
      ],
    }),
  }),
});

export const {
  useGetCancellationsQuery,
  useGetCancellationCountsQuery,
  useGetCancellationDetailQuery,
  useActOnCancellationMutation,
} = cancellationsApi;
