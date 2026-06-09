/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardDataDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, number | void>({
      query: (days?: number) => ({
        url: '/dashboard',
        method: 'GET',
        params: days ? { days } : undefined,
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
