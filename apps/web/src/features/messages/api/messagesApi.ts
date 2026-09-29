/**
 * eBay Messages API — RTK Query endpoints.
 *
 * `conversation_type` is required on every Message API read (eBay's own
 * contract), so every query/mutation here threads a `type` through — never
 * inferred, never defaulted.
 */

import type {
  EbayBulkConversationStatus,
  EbayConversationRead,
  EbayConversationStatus,
  EbayConversationThreadDto,
  EbayConversationType,
  EbayReplyMessage,
  EbaySendMessageResultDto,
  EbayUnreadCountDto,
  PaginatedConversationsDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

/**
 * How often the sidebar badge re-checks.
 *
 * Same cadence as the Action Center badge: the counter is OUR column, fed by
 * the webhook, so polling it costs eBay nothing.
 */
export const MESSAGES_UNREAD_POLL_INTERVAL_MS = 120_000;

export interface ConversationsQueryArgs {
  ebayAccountId: string;
  type: EbayConversationType;
  status?: EbayConversationStatus;
  page: number;
  limit: number;
}

export interface ThreadQueryArgs {
  conversationId: string;
  ebayAccountId: string;
  type: EbayConversationType;
  page: number;
  limit: number;
}

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUnreadMessageCount: builder.query<EbayUnreadCountDto, void>({
      query: () => ({ url: '/ebay/messages/unread-count' }),
      providesTags: [{ type: 'Messages', id: 'UNREAD' }],
    }),
    getConversations: builder.query<PaginatedConversationsDto, ConversationsQueryArgs>({
      query: (params) => ({ url: '/ebay/messages/conversations', params }),
      providesTags: [{ type: 'Messages', id: 'LIST' }],
    }),
    getConversationThread: builder.query<EbayConversationThreadDto, ThreadQueryArgs>({
      query: ({ conversationId, ...params }) => ({
        url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}`,
        params,
      }),
      providesTags: (_result, _error, args) => [{ type: 'Messages', id: args.conversationId }],
    }),
    replyToConversation: builder.mutation<EbaySendMessageResultDto, { conversationId: string } & EbayReplyMessage>({
      query: ({ conversationId, ...body }) => ({
        url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}/reply`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, args) => [
        { type: 'Messages', id: args.conversationId },
        { type: 'Messages', id: 'LIST' },
      ],
    }),
    setConversationRead: builder.mutation<void, { conversationId: string } & EbayConversationRead>({
      query: ({ conversationId, ...body }) => ({
        url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}/read`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Messages', id: 'LIST' }, { type: 'Messages', id: 'UNREAD' }],
    }),
    bulkConversationStatus: builder.mutation<{ succeeded: string[]; failed: string[] }, EbayBulkConversationStatus>({
      query: (body) => ({ url: '/ebay/messages/conversations/bulk-status', method: 'POST', body }),
      invalidatesTags: [{ type: 'Messages', id: 'LIST' }, { type: 'Messages', id: 'UNREAD' }],
    }),
    refreshUnread: builder.mutation<{ unread: number }, { ebayAccountId: string }>({
      query: (body) => ({ url: '/ebay/messages/refresh-unread', method: 'POST', body }),
      invalidatesTags: [{ type: 'Messages', id: 'UNREAD' }],
    }),
  }),
});

export const {
  useGetUnreadMessageCountQuery,
  useGetConversationsQuery,
  useGetConversationThreadQuery,
  useReplyToConversationMutation,
  useSetConversationReadMutation,
  useBulkConversationStatusMutation,
  useRefreshUnreadMutation,
} = messagesApi;
