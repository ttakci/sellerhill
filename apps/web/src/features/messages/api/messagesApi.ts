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
  EbayUnreadBreakdownDto,
  EbayUnreadCountDto,
  PaginatedConversationsDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

/**
 * How often the sidebar badge re-checks.
 *
 * Same cadence as the Action Center badge. The counter is OUR column, fed by
 * the webhook; only a counter older than `ebay.messages.unreadRecountMinutes`
 * (default 60) makes the server recount from eBay. Paused while the tab is hidden.
 */
export const MESSAGES_UNREAD_POLL_INTERVAL_MS = 120_000;

/**
 * How often an OPEN Messages page recounts its store's unread per type (3
 * Message API calls, 500,000/day pool). New messages arrive by webhook and a
 * return to the tab recounts at once, so this only catches a read on eBay's
 * site while the page sits open. Paused while the tab is hidden.
 */
export const MESSAGES_BREAKDOWN_POLL_INTERVAL_MS = 1_800_000;

export interface ConversationsQueryArgs {
  ebayAccountId: string;
  /** Omitted = both types merged (Archive / Deleted). */
  type?: EbayConversationType;
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
    getUnreadBreakdown: builder.query<EbayUnreadBreakdownDto, { ebayAccountId: string }>({
      query: (params) => ({ url: '/ebay/messages/unread-breakdown', params }),
      providesTags: [{ type: 'Messages', id: 'BREAKDOWN' }],
      // The server stores the recount it just made, so the sidebar badge has to re-read.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(baseApi.util.invalidateTags([{ type: 'Messages', id: 'UNREAD' }]));
        } catch {
          // A failed recount leaves the badge at its last value.
        }
      },
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
      invalidatesTags: [
        { type: 'Messages', id: 'LIST' },
        { type: 'Messages', id: 'UNREAD' },
        { type: 'Messages', id: 'BREAKDOWN' },
      ],
    }),
    bulkConversationStatus: builder.mutation<{ succeeded: string[]; failed: string[] }, EbayBulkConversationStatus>({
      query: (body) => ({ url: '/ebay/messages/conversations/bulk-status', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Messages', id: 'LIST' },
        { type: 'Messages', id: 'UNREAD' },
        { type: 'Messages', id: 'BREAKDOWN' },
      ],
    }),
  }),
});

export const {
  useGetUnreadMessageCountQuery,
  useGetUnreadBreakdownQuery,
  useGetConversationsQuery,
  useGetConversationThreadQuery,
  useReplyToConversationMutation,
  useSetConversationReadMutation,
  useBulkConversationStatusMutation,
} = messagesApi;
