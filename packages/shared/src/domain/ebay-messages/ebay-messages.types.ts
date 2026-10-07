// packages/shared/src/domain/ebay-messages/ebay-messages.types.ts

/**
 * eBay Messages — the seller inbox for buyer↔seller conversations, sourced
 * from eBay's Message API (Trading `GetMemberMessages`/`AddMemberMessageAAQToPartner`
 * successor — the REST Message API), plus the Notification API's
 * `NEW_MESSAGE` webhook that tells us a new message arrived without polling.
 *
 * Two conversation TYPEs exist and every read requires one explicitly
 * (eBay's own contract — `conversation_type` is a required query param, never
 * inferred): `FROM_MEMBERS` (buyer↔seller) and `FROM_EBAY` (eBay-to-seller
 * system notices). They are fetched, replied to and archived separately.
 */

/** Which side originated the conversation. Required on every Message API read. */
export enum EbayConversationType {
  FROM_MEMBERS = 'FROM_MEMBERS',
  FROM_EBAY = 'FROM_EBAY',
}

/**
 * eBay's own status vocabulary for a conversation/message. `READ`/`UNREAD` are
 * reported by eBay but are never something a seller SETS directly through
 * update/bulk-update — those two go through the separate `read` boolean flag.
 * See {@link EbayConversationMutableStatus}.
 */
export enum EbayConversationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVE = 'ARCHIVE',
  DELETE = 'DELETE',
  READ = 'READ',
  UNREAD = 'UNREAD',
}

/** What a seller may SET through update/bulk-update (READ/UNREAD go through the `read` flag). */
export type EbayConversationMutableStatus =
  | EbayConversationStatus.ACTIVE
  | EbayConversationStatus.ARCHIVE
  | EbayConversationStatus.DELETE;

/**
 * What `bulk_update_conversation` may set: the mutable statuses plus READ
 * (its `conversationStatus` takes ACTIVE/ARCHIVE/DELETE/READ/UNREAD —
 * docs/ebay-reference/commerce-message-v1-oas3.json). Bulk READ marks up to
 * ten conversations read in one call instead of one call each.
 */
export type EbayConversationBulkStatus = EbayConversationMutableStatus | EbayConversationStatus.READ;

/** Media attachment kinds the Message API reports on a message. */
export enum EbayMessageMediaType {
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  DOC = 'DOC',
  TXT = 'TXT',
}

/** eBay's own cap on a single message's text. */
export const EBAY_MESSAGE_MAX_LENGTH = 2000;

/** eBay's own cap on `limit` for a conversations list read. */
export const EBAY_CONVERSATIONS_MAX_LIMIT = 50;

/** eBay's own cap on how many conversation ids one bulk status update may carry. */
export const EBAY_BULK_CONVERSATIONS_MAX = 10;

/**
 * The two OAuth scopes this feature needs, granted together or not at all —
 * `commerce.message` to read/reply, `commerce.notification.subscription` to
 * manage the NEW_MESSAGE webhook subscription. Spread into
 * `EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES` (ebay.constants.ts) so there is ONE
 * list of what a store connect grants; a store connected before this scope
 * was added has to reconnect to pick them up (see
 * `EbayAccountPublicDto.messagingEnabled`).
 */
export const EBAY_MESSAGING_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/commerce.message',
  'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
] as const;

/** True only when every scope in {@link EBAY_MESSAGING_SCOPES} was granted. */
export function hasMessagingScopes(granted: readonly string[] | null | undefined): boolean {
  if (!granted) {
    return false;
  }
  return EBAY_MESSAGING_SCOPES.every((scope) => granted.includes(scope));
}

/**
 * The web Messages page's folder rail. Not an eBay concept — a grouping over
 * {@link EbayConversationStatus}, each folder sending one `conversation_status`
 * to eBay: `ALL` → ACTIVE (archived/deleted never appear), `UNREAD` → UNREAD,
 * `ARCHIVE` → ARCHIVE. eBay does the filtering; only the demo fixtures filter
 * client-side.
 */
export enum MessagesFolder {
  ALL = 'all',
  UNREAD = 'unread',
  ARCHIVE = 'archive',
  /** eBay's "Deleted" folder — `conversation_status=DELETE` (2026-10-01, so the rail mirrors eBay's own). */
  DELETED = 'deleted',
}
