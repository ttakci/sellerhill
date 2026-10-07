// packages/shared/src/schemas/ebay-messages/ebay-messages.schema.ts
import { z } from 'zod';

import {
  EBAY_BULK_CONVERSATIONS_MAX,
  EBAY_CONVERSATIONS_MAX_LIMIT,
  EBAY_MESSAGE_MAX_LENGTH,
  EbayConversationStatus,
  EbayConversationType,
} from '../../domain/ebay-messages/ebay-messages.types';

/** `GET .../conversations` query. `conversation_type` is required — see CLAUDE.md's eBay Messages constraints. */
export const ebayConversationsQuerySchema = z.object({
  ebayAccountId: z.string().uuid(),
  /** Omitted = both types merged (the Archive / Deleted folders, which eBay's own page does not split by type). */
  type: z.nativeEnum(EbayConversationType).optional(),
  status: z.nativeEnum(EbayConversationStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(EBAY_CONVERSATIONS_MAX_LIMIT).default(25),
});

/** `POST .../conversations/:id/reply` body. */
export const ebayReplyMessageSchema = z.object({
  ebayAccountId: z.string().uuid(),
  type: z.nativeEnum(EbayConversationType),
  text: z.string().trim().min(1).max(EBAY_MESSAGE_MAX_LENGTH),
});

/** `PUT .../conversations/:id/read` body — READ/UNREAD go through this flag, never `status`. */
export const ebayConversationReadSchema = z.object({
  ebayAccountId: z.string().uuid(),
  type: z.nativeEnum(EbayConversationType),
  read: z.boolean(),
});

/** `POST .../conversations/bulk-status` body. */
export const ebayBulkConversationStatusSchema = z.object({
  ebayAccountId: z.string().uuid(),
  type: z.nativeEnum(EbayConversationType),
  conversationIds: z.array(z.string().min(1)).min(1).max(EBAY_BULK_CONVERSATIONS_MAX),
  status: z.enum([
    EbayConversationStatus.ACTIVE,
    EbayConversationStatus.ARCHIVE,
    EbayConversationStatus.DELETE,
    EbayConversationStatus.READ,
  ]),
});

export type EbayConversationsQuery = z.infer<typeof ebayConversationsQuerySchema>;
export type EbayReplyMessage = z.infer<typeof ebayReplyMessageSchema>;
export type EbayConversationRead = z.infer<typeof ebayConversationReadSchema>;
export type EbayBulkConversationStatus = z.infer<typeof ebayBulkConversationStatusSchema>;
