// packages/shared/src/domain/ebay-messages/ebay-messages.dto.ts

import type { EbayConversationStatus, EbayConversationType, EbayMessageMediaType } from './ebay-messages.types';

/** One attachment on a message. */
export interface EbayMessageMediaDto {
  mediaName: string;
  /** eBay's own enum value; kept as `string` too since eBay may add a kind we do not model yet. */
  mediaType: EbayMessageMediaType | string;
  mediaUrl: string;
}

/** One message inside a conversation thread. */
export interface EbayMessageDto {
  messageId: string;
  subject: string | null;
  body: string;
  senderUsername: string;
  recipientUsername: string;
  read: boolean;
  createdAt: string;
  media: EbayMessageMediaDto[];
}

/** One row in the conversations list. */
export interface EbayConversationDto {
  conversationId: string;
  type: EbayConversationType;
  status: EbayConversationStatus;
  title: string | null;
  unreadCount: number;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  latestMessage: EbayMessageDto | null;
  otherPartyUsername: string | null;
}

/** `GET .../conversations` — server-paginated, per the codebase's list-endpoint rule. */
export interface PaginatedConversationsDto {
  items: EbayConversationDto[];
  total: number;
  page: number;
  limit: number;
}

/** `GET .../conversations/:id/messages` — one conversation's full thread. */
export interface EbayConversationThreadDto {
  conversationId: string;
  type: EbayConversationType;
  status: EbayConversationStatus;
  title: string | null;
  messages: EbayMessageDto[];
  total: number;
  page: number;
  limit: number;
}

/** `GET .../unread-count` — the sidebar badge, platform-wide and per-store. */
export interface EbayUnreadCountDto {
  total: number;
  byAccount: Array<{ ebayAccountId: string; unread: number }>;
}

/** Result of sending a reply. */
export interface EbaySendMessageResultDto {
  messageId: string;
}
