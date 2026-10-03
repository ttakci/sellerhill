/**
 * Action Center API — RTK Query endpoints.
 */

import type { ActionCenterSummaryDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

/**
 * How often the sidebar badge re-checks.
 *
 * Nothing here is real-time: the signals behind it move on cron cycles measured
 * in minutes to hours (order sync every 15m, Amazon cost-capture every 3h), so
 * polling faster would only add load without changing what the seller sees.
 */
export const ACTION_CENTER_POLL_INTERVAL_MS = 120_000;

/** `ebayAccountId → that store's summary`, one entry per requested store. */
export type ActionCenterStoreSummaries = Record<string, ActionCenterSummaryDto>;

export const actionCenterApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /** Every store at once — the sidebar badge's total. */
    getActionCenter: builder.query<ActionCenterSummaryDto, void>({
      query: () => ({ url: '/action-center', method: 'GET' }),
      providesTags: ['ActionCenter'],
    }),
    /**
     * One summary per store, for the store-specific page.
     *
     * The page needs every store's count (each option of its store picker
     * carries one, so a store with waiting work is never hidden behind the
     * selection) and the selected store's full list. One `?ebayAccountId=`
     * call per store answers both, and stores are few. The counts are fetched
     * here rather than added to the unfiltered response, because the sidebar
     * badge polls that one on every page and would pay for N store summaries
     * it never shows.
     */
    getActionCenterByStore: builder.query<ActionCenterStoreSummaries, readonly string[]>({
      async queryFn(storeIds, _api, _extraOptions, baseQuery) {
        const results = await Promise.all(
          storeIds.map((ebayAccountId) =>
            baseQuery({ url: '/action-center', method: 'GET', params: { ebayAccountId } })
          )
        );
        const summaries: ActionCenterStoreSummaries = {};
        for (const [index, result] of results.entries()) {
          if (result.error) {
            return { error: result.error };
          }
          summaries[storeIds[index]] = result.data as ActionCenterSummaryDto;
        }
        return { data: summaries };
      },
      providesTags: ['ActionCenter'],
    }),
  }),
});

export const { useGetActionCenterQuery, useGetActionCenterByStoreQuery } = actionCenterApi;
