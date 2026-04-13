/**
 * Dashboard API - RTK Query Endpoints
 */

import type { DashboardDataDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardDataDto, void>({
      query: () => ({
        url: '/dashboard',
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
