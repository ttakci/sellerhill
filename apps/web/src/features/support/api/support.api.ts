import type {
  CreateSupportMessageRequest,
  SupportAgentAvailability,
  SupportAgentPresenceDto,
  SupportConversationDetailDto,
  SupportConversationListDto,
  SupportMessageResponseDto,
  SupportQueueQuery,
  TransferSupportConversationRequest,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const supportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSupportConversations: builder.query<SupportConversationListDto, SupportQueueQuery>({
      query: (params) => ({ url: '/support/conversations', params }),
      providesTags: ['Support'],
    }),
    getSupportConversation: builder.query<SupportConversationDetailDto, string>({
      query: (id) => `/support/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Support', id }],
    }),
    claimSupportConversation: builder.mutation<SupportConversationDetailDto, string>({ query: (id) => ({ url: `/support/conversations/${id}/claim`, method: 'POST' }), invalidatesTags: ['Support'] }),
    releaseSupportConversation: builder.mutation<void, string>({ query: (id) => ({ url: `/support/conversations/${id}/release`, method: 'POST' }), invalidatesTags: ['Support'] }),
    transferSupportConversation: builder.mutation<void, { id: string; request: TransferSupportConversationRequest }>({ query: ({ id, request }) => ({ url: `/support/conversations/${id}/transfer`, method: 'POST', body: request }), invalidatesTags: ['Support'] }),
    replySupportConversation: builder.mutation<SupportMessageResponseDto, { id: string; request: CreateSupportMessageRequest }>({ query: ({ id, request }) => ({ url: `/support/conversations/${id}/reply`, method: 'POST', body: request }), invalidatesTags: ['Support'] }),
    readSupportConversation: builder.mutation<void, { id: string; throughSequence: string }>({ query: ({ id, throughSequence }) => ({ url: `/support/conversations/${id}/read`, method: 'POST', body: { throughSequence } }), invalidatesTags: ['Support'] }),
    resolveSupportConversation: builder.mutation<void, string>({ query: (id) => ({ url: `/support/conversations/${id}/resolve`, method: 'POST' }), invalidatesTags: ['Support'] }),
    reopenSupportConversation: builder.mutation<void, string>({ query: (id) => ({ url: `/support/conversations/${id}/reopen-support`, method: 'POST' }), invalidatesTags: ['Support'] }),
    returnSupportConversationToAi: builder.mutation<void, string>({ query: (id) => ({ url: `/support/conversations/${id}/return-to-ai`, method: 'POST' }), invalidatesTags: ['Support', 'Assistant'] }),
    setSupportPresence: builder.mutation<void, SupportAgentAvailability>({ query: (availability) => ({ url: '/support/presence/preference', method: 'POST', body: { availability } }), invalidatesTags: ['Support'] }),
    heartbeatSupportPresence: builder.mutation<void, string>({ query: (connectionId) => ({ url: '/support/presence/heartbeat', method: 'POST', body: { connectionId } }) }),
    getEligibleSupportTargets: builder.query<SupportAgentPresenceDto[], void>({ query: () => '/support/presence/eligible-transfer-targets', providesTags: ['Support'] }),
  }),
});

export const {
  useClaimSupportConversationMutation,
  useGetEligibleSupportTargetsQuery,
  useGetSupportConversationQuery,
  useHeartbeatSupportPresenceMutation,
  useListSupportConversationsQuery,
  useReadSupportConversationMutation,
  useReleaseSupportConversationMutation,
  useReopenSupportConversationMutation,
  useReplySupportConversationMutation,
  useResolveSupportConversationMutation,
  useReturnSupportConversationToAiMutation,
  useSetSupportPresenceMutation,
  useTransferSupportConversationMutation,
} = supportApi;
