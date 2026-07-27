import type {
  AssistantConversationDto,
  AssistantConversationListDto,
  AssistantConversationStatus,
  AssistantMessageDto,
  AssistantMessageListDto,
  CreateAssistantConversationRequest,
  CreateAssistantMessageRequest,
  MarkAssistantConversationReadRequest,
  RequestSupportRequest,
  UpdateAssistantConversationRequest,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listAssistantConversations: builder.query<AssistantConversationListDto, { limit?: number }>({
      query: (params) => ({ url: '/assistant/conversations', params }),
      providesTags: ['Assistant'],
    }),
    createAssistantConversation: builder.mutation<AssistantConversationDto, CreateAssistantConversationRequest>({
      query: (body) => ({ url: '/assistant/conversations', method: 'POST', body }),
      invalidatesTags: ['Assistant'],
    }),
    getAssistantConversation: builder.query<AssistantConversationDto, string>({
      query: (id) => `/assistant/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Assistant', id }],
    }),
    getAssistantMessages: builder.query<AssistantMessageListDto, { beforeSequence?: string; conversationId: string; limit?: number }>({
      query: ({ conversationId, ...params }) => ({ url: `/assistant/conversations/${conversationId}/messages`, params }),
      providesTags: (_result, _error, { conversationId }) => [{ type: 'Assistant', id: conversationId }],
    }),
    renameAssistantConversation: builder.mutation<AssistantConversationDto, { id: string; request: UpdateAssistantConversationRequest }>({
      query: ({ id, request }) => ({ url: `/assistant/conversations/${id}`, method: 'PATCH', body: request }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Assistant', id }],
    }),
    markAssistantConversationRead: builder.mutation<void, { id: string; request: MarkAssistantConversationReadRequest }>({
      query: ({ id, request }) => ({ url: `/assistant/conversations/${id}/read`, method: 'POST', body: request }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Assistant', id }],
    }),
    archiveAssistantConversation: builder.mutation<AssistantConversationDto, string>({ query: (id) => ({ url: `/assistant/conversations/${id}/archive`, method: 'POST' }), invalidatesTags: ['Assistant'] }),
    unarchiveAssistantConversation: builder.mutation<AssistantConversationDto, { id: string; status: AssistantConversationStatus }>({ query: ({ id, status }) => ({ url: `/assistant/conversations/${id}/unarchive`, method: 'POST', body: { status } }), invalidatesTags: ['Assistant'] }),
    reopenAssistantAi: builder.mutation<AssistantConversationDto, string>({ query: (id) => ({ url: `/assistant/conversations/${id}/reopen-ai`, method: 'POST' }), invalidatesTags: ['Assistant'] }),
    reopenAssistantSupport: builder.mutation<AssistantConversationDto, string>({ query: (id) => ({ url: `/assistant/conversations/${id}/reopen-support`, method: 'POST' }), invalidatesTags: ['Assistant'] }),
    deleteAssistantConversation: builder.mutation<void, string>({ query: (id) => ({ url: `/assistant/conversations/${id}`, method: 'DELETE' }), invalidatesTags: ['Assistant'] }),
    restoreAssistantConversation: builder.mutation<AssistantConversationDto, string>({ query: (id) => ({ url: `/assistant/conversations/${id}/restore`, method: 'POST' }), invalidatesTags: ['Assistant'] }),
    requestAssistantSupport: builder.mutation<void, { id: string; request: RequestSupportRequest }>({ query: ({ id, request }) => ({ url: `/assistant/conversations/${id}/support-request`, method: 'POST', body: request }), invalidatesTags: ['Assistant'] }),
    cancelAssistantSupport: builder.mutation<void, string>({ query: (id) => ({ url: `/assistant/conversations/${id}/support-request/cancel`, method: 'POST' }), invalidatesTags: ['Assistant'] }),
    postAssistantSupportMessage: builder.mutation<AssistantMessageDto, { conversationId: string; request: CreateAssistantMessageRequest }>({ query: ({ conversationId, request }) => ({ url: `/assistant/conversations/${conversationId}/messages`, method: 'POST', body: request }), invalidatesTags: ['Assistant'] }),
  }),
});

export const {
  useArchiveAssistantConversationMutation,
  useCancelAssistantSupportMutation,
  useCreateAssistantConversationMutation,
  useDeleteAssistantConversationMutation,
  useGetAssistantConversationQuery,
  useGetAssistantMessagesQuery,
  useListAssistantConversationsQuery,
  useMarkAssistantConversationReadMutation,
  usePostAssistantSupportMessageMutation,
  useRenameAssistantConversationMutation,
  useReopenAssistantAiMutation,
  useReopenAssistantSupportMutation,
  useRequestAssistantSupportMutation,
  useRestoreAssistantConversationMutation,
  useUnarchiveAssistantConversationMutation,
} = assistantApi;
