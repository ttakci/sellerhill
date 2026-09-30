import {
  type AmazonAccountPublicDto,
  type CreateAmazonAccountFormData,
  type StartAutoFulfillResultDto,
  type UpdateAmazonAccountFormData,
} from '@repo/shared';

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
    /**
     * Convert this order's tracking number on demand.
     *
     * `reasonKey` is an i18n key, not a sentence — the backend has no locale.
     * `converted: false` with a reasonKey is a normal, expected outcome (no
     * tracking number yet, quota exhausted, provider unavailable), not an
     * error, so the caller shows the reason rather than a failure dialog.
     */
    convertOrderTracking: builder.mutation<
      { converted: boolean; trackingNumber: string | null; reasonKey: string | null },
      { orderId: string }
    >({
      query: ({ orderId }) => ({
        url: `/amazon/orders/${orderId}/convert-tracking`,
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
    }),
    /**
     * Start the automatic Amazon purchase for one order by hand. Offered only
     * while `OrderDto.canStartAutoFulfill` is true; every refusal comes back
     * as a 409 whose message is an i18n key.
     */
    startAutoFulfill: builder.mutation<StartAutoFulfillResultDto, { orderId: string }>({
      query: ({ orderId }) => ({
        url: `/amazon/orders/${orderId}/start-auto-fulfill`,
        method: 'POST',
      }),
      invalidatesTags: ['Orders'],
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
  useConvertOrderTrackingMutation,
  useStartAutoFulfillMutation,
} = amazonApi;
