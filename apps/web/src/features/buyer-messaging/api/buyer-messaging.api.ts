import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export interface CreateBuyerMessageTemplateInput {
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
  locale?: string;
}

export interface UpdateBuyerMessageTemplateInput {
  name?: string;
  body?: string;
  locale?: string;
}

export const buyerMessagingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBuyerMessageTemplates: builder.query<BuyerMessageTemplate[], { eventType?: BuyerMessageEventType } | void>({
      query: (args) => ({
        url: '/buyer-messaging/templates',
        params: args?.eventType ? { eventType: args.eventType } : undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'BuyerMessageTemplates' as const, id })),
              { type: 'BuyerMessageTemplates', id: 'LIST' },
            ]
          : [{ type: 'BuyerMessageTemplates', id: 'LIST' }],
    }),
    createBuyerMessageTemplate: builder.mutation<BuyerMessageTemplate, CreateBuyerMessageTemplateInput>({
      query: (body) => ({
        url: '/buyer-messaging/templates',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'BuyerMessageTemplates', id: 'LIST' }],
    }),
    updateBuyerMessageTemplate: builder.mutation<BuyerMessageTemplate, { id: string; body: UpdateBuyerMessageTemplateInput }>({
      query: ({ id, body }) => ({
        url: `/buyer-messaging/templates/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'BuyerMessageTemplates', id },
        { type: 'BuyerMessageTemplates', id: 'LIST' },
      ],
    }),
    deleteBuyerMessageTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/buyer-messaging/templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'BuyerMessageTemplates', id },
        { type: 'BuyerMessageTemplates', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetBuyerMessageTemplatesQuery,
  useCreateBuyerMessageTemplateMutation,
  useUpdateBuyerMessageTemplateMutation,
  useDeleteBuyerMessageTemplateMutation,
} = buyerMessagingApi;
