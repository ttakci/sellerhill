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

export const actionCenterApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getActionCenter: builder.query<ActionCenterSummaryDto, void>({
      query: () => ({ url: '/action-center', method: 'GET' }),
      providesTags: ['ActionCenter'],
    }),
  }),
});

export const { useGetActionCenterQuery } = actionCenterApi;
