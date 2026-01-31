import { baseApi } from '@/api/baseApi';
import { OrderDto, OrderStatsDto } from '@repo/shared';

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query<OrderDto[], void>({
      query: () => '/orders',
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
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Orders', id }, 'Orders'],
    }),
  }),
});

export const { useGetOrdersQuery, useGetOrderStatsQuery, useGetOrderByIdQuery, useUpdateOrderAmazonDetailsMutation } =
  ordersApi;
