import { type OrderDto, type OrderStatsDto, type OrderFiltersDto, type OrderSyncResponseDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<{ orders: OrderDto[]; total: number }, OrderFiltersDto | void>({
      query: (filters) => {
        const params: Record<string, string> = {};
        if (filters) {
          if (filters.page) {params.page = String(filters.page);}
          if (filters.limit) {params.limit = String(filters.limit);}
          if (filters.status) {params.status = filters.status;}
          if (filters.search) {params.search = filters.search;}
          if (filters.dateFrom) {params.dateFrom = filters.dateFrom;}
          if (filters.dateTo) {params.dateTo = filters.dateTo;}
          if (filters.sortBy) {params.sortBy = filters.sortBy;}
          if (filters.sortOrder) {params.sortOrder = filters.sortOrder;}
        }
        return { url: '/orders', params };
      },
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
  useGetOrderStatsQuery,
  useGetOrderByIdQuery,
  useUpdateOrderAmazonDetailsMutation,
  useTriggerOrderSyncMutation,
} = ordersApi;
