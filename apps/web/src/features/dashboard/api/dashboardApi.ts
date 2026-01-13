/**
 * Dashboard API - RTK Query Endpoints
 *
 * Provides dashboard endpoints:
 * - getDashboard: Get dashboard data
 */

import { baseApi } from '@/api/baseApi';

export interface DashboardResponse {
  status: 'ok';
  message: string;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get dashboard data
     */
    getDashboard: builder.query<DashboardResponse, void>({
      query: () => ({
        url: '/dashboard',
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
