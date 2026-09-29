import {
  type OrderDto,
  type OrderStatsDto,
  type OrderFiltersDto,
  type OrderStageCountsDto,
  type OrderSyncResponseDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<{ orders: OrderDto[]; total: number }, OrderFiltersDto | void>({
      query: (filters) => {
        const params: Record<string, string> = {};
        if (filters) {
          if (filters.page) {
            params.page = String(filters.page);
          }
          if (filters.limit) {
            params.limit = String(filters.limit);
          }
          if (filters.status) {
            params.status = filters.status;
          }
          if (filters.search) {
            params.search = filters.search;
          }
          if (filters.ebayAccountId) {
            params.ebayAccountId = filters.ebayAccountId;
          }
          if (filters.dateFrom) {
            params.dateFrom = filters.dateFrom;
          }
          if (filters.dateTo) {
            params.dateTo = filters.dateTo;
          }
          if (filters.autoFulfillNeedsAttention) {
            params.autoFulfillNeedsAttention = 'true';
          }
          if (filters.fulfillmentState) {
            params.fulfillmentState = filters.fulfillmentState;
          }
          // The controller reads `?stage=a,b` and ANDs the list as `IN (...)`.
          if (filters.stages && filters.stages.length > 0) {
            params.stage = filters.stages.join(',');
          }
          // The controller reads this as `tracked` ('true' | 'false'); `false` is a
          // real filter (untracked orders), so test for undefined, not truthiness.
          if (filters.isTracked !== undefined) {
            params.tracked = String(filters.isTracked);
          }
          if (filters.sortBy) {
            params.sortBy = filters.sortBy;
          }
          if (filters.sortOrder) {
            params.sortOrder = filters.sortOrder;
          }
        }
        return { url: '/orders', params };
      },
      providesTags: ['Orders'],
    }),
    getOrderStageCounts: builder.query<OrderStageCountsDto, { ebayAccountId?: string; isTracked?: boolean } | void>({
      query: (args) => {
        const params: Record<string, string> = {};
        if (args?.ebayAccountId) {
          params.ebayAccountId = args.ebayAccountId;
        }
        if (args?.isTracked !== undefined) {
          params.tracked = String(args.isTracked);
        }
        return { url: '/orders/stage-counts', params };
      },
      // Same tag as the list, so a mutation that invalidates the list also
      // refreshes the tab counts.
      providesTags: ['Orders'],
    }),
    getOrderStats: builder.query<OrderStatsDto, void>({
      query: () => '/orders/stats',
      providesTags: ['Orders'],
    }),
    getOrderById: builder.query<OrderDto, string>({
      query: (id) => `/orders/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Orders', id }],
    }),
    updateOrderAmazonDetails: builder.mutation<
      OrderDto,
      {
        id: string;
        data: { amazonOrderUrl?: string; amazonTrackingUrl?: string; amazonTax?: number; amazonShipping?: number };
      }
    >({
      query: ({ id, data }) => ({
        url: `/orders/${id}/amazon-details`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Orders', id }, 'Orders'],
    }),
    triggerOrderSync: builder.mutation<OrderSyncResponseDto, void>({
      query: () => ({
        url: '/orders/sync',
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderStageCountsQuery,
  useGetOrderStatsQuery,
  useGetOrderByIdQuery,
  useUpdateOrderAmazonDetailsMutation,
  useTriggerOrderSyncMutation,
} = ordersApi;
