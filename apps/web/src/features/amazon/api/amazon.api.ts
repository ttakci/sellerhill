import { type AmazonAccountPublicDto, type CreateAmazonAccountFormData, type UpdateAmazonAccountFormData } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const amazonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAmazonAccounts: builder.query<AmazonAccountPublicDto[], void>({
      query: () => '/amazon/accounts',
      providesTags: ['Amazon'],
    }),
    createAmazonAccount: builder.mutation<AmazonAccountPublicDto, CreateAmazonAccountFormData>({
      query: (data) => ({
        url: '/amazon/accounts',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Amazon'],
    }),
    updateAmazonAccount: builder.mutation<
      AmazonAccountPublicDto,
      { id: string; data: UpdateAmazonAccountFormData }
    >({
      query: ({ id, data }) => ({
        url: `/amazon/accounts/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Amazon'],
    }),
    deleteAmazonAccount: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/amazon/accounts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Amazon'],
    }),
    verifyAmazonAccount: builder.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (id) => ({
        url: `/amazon/accounts/${id}/verify`,
        method: 'POST',
      }),
      invalidatesTags: ['Amazon'],
    }),
    linkAmazonOrder: builder.mutation<
      {
        success: boolean;
        message: string;
        linked?: boolean;
        reason?: 'cost_capture_failed';
      },
      { orderId: string; amazonAccountId: string; amazonOrderId: string }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/amazon/orders/${orderId}/link-amazon`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Orders', 'Amazon'],
    }),
  }),
});

export const {
  useGetAmazonAccountsQuery,
  useCreateAmazonAccountMutation,
  useUpdateAmazonAccountMutation,
  useDeleteAmazonAccountMutation,
  useVerifyAmazonAccountMutation,
  useLinkAmazonOrderMutation,
} = amazonApi;
