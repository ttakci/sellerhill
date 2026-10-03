import { Injectable, Logger } from '@nestjs/common';
import {
  EBAY_BULK_CONVERSATIONS_MAX,
  EBAY_MESSAGE_MAX_LENGTH,
  EbayAccountStatus,
  EbayCallPriority,
  EbayConversationDto,
  EbayConversationStatus,
  EbayConversationThreadDto,
  EbayConversationType,
  EbaySendMessageResultDto,
  EbayUnreadBreakdownDto,
  EbayUnreadCountDto,
  PaginatedConversationsDto,
  hasMessagingScopes,
  type EbayBulkConversationStatus,
  type EbayConversationRead,
  type EbayConversationsQuery,
  type EbayReplyMessage,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';
import { EbayNotificationService } from '../ebay/notifications/ebay-notification.service';

import { EbayMessageApiError, EbayMessageClient } from './ebay-message.client';

/** Error keys this service throws (`Error.message`); the controller maps them to HTTP statuses. */
export const MESSAGING_ERRORS = {
  ACCOUNT_NOT_FOUND: 'ebay.errors.accountNotFound',
  SCOPE_MISSING: 'ebay.errors.messagingScopeMissing',
  REPLY_NOT_ALLOWED: 'ebay.errors.messagingReplyNotAllowed',
  UNAVAILABLE: 'ebay.errors.messagingUnavailable',
  REJECTED: 'ebay.errors.messagingRejected',
  TOO_LONG: 'ebay.errors.messageTooLong',
} as const;

/**
 * Without the NEW_MESSAGE webhook nothing keeps the stored counter current, so
 * the badge read recounts a store from eBay once its counter is older than this.
 */
const UNREAD_STALE_MS = 15 * 60 * 1000;

/**
 * A SUBSCRIBED store's counter is kept by the webhook, but a delivery eBay
 * dropped (or one we could not match) would leave it wrong for ever — so it is
 * recounted too once it is older than a day.
 */
const SUBSCRIBED_UNREAD_STALE_MS = 24 * 60 * 60 * 1000;

/** How eBay words a 403 that is about the token's grant rather than the request. */
const SCOPE_ERROR_TEXT = /scope|permission|authoriz/i;

interface MessagingAccountRow {
  granted_scopes: string[] | null;
  ebay_username: string | null;
  seller_id: string;
  unread_message_count: number;
  unread_message_synced_at: Date | null;
}

interface UnreadAccountRow {
  id: string;
  granted_scopes: string[] | null;
  unread_message_count: number;
  unread_message_synced_at: Date | null;
  message_subscription_id: string | null;
}

interface ListingImageRow {
  ebay_item_id: string | null;
  /** JSONB array (already parsed by pg); a legacy row may hold a JSON string. */
  image_urls: string[] | string | null;
}

export interface ThreadQuery {
  ebayAccountId: string;
  type: EbayConversationType;
  page: number;
  limit: number;
}

/**
 * The seller inbox over eBay's Message API. Nothing a message SAYS is stored —
 * every list/thread read goes to eBay with the store's own token; the only
 * thing kept locally is the unread counter behind the sidebar badge.
 *
 * Every call is scoped to a store the user owns (ACTIVE only) and granted the
 * messaging scopes. Writes always use the conversation type from the request,
 * never one read from a list row.
 */
@Injectable()
export class EbayMessagesService {
  private readonly logger = new Logger(EbayMessagesService.name);

  constructor(
    private readonly client: EbayMessageClient,
    private readonly ebayService: EbayService,
    private readonly db: DatabaseService,
    private readonly notifications: EbayNotificationService
  ) {}

  async listConversations(userId: string, q: EbayConversationsQuery): Promise<PaginatedConversationsDto> {
    const account = await this.loadAccount(userId, q.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(q.ebayAccountId);
    const result = await this.call(account, () =>
      this.client.getConversations(
        token,
        {
          type: q.type,
          ...(q.status ? { status: q.status } : {}),
          limit: q.limit,
          offset: (q.page - 1) * q.limit,
        },
        EbayCallPriority.INTERACTIVE
      )
    );
    const images = await this.loadListingImages(
      q.ebayAccountId,
      result.items.map((item) => item.referenceId)
    );
    return {
      items: result.items.map((item) => ({
        ...item,
        otherPartyUsername: resolveOtherParty(item, account),
        imageUrl: item.referenceId ? (images.get(item.referenceId) ?? null) : null,
      })),
      total: result.total,
      page: q.page,
      limit: q.limit,
    };
  }

  /**
   * Photos for the conversations on one page: eBay names the item a thread is
   * about (`referenceId` = item id), and the store's own listings know that
   * item's product. Fail-soft — a missing picture only leaves the avatar.
   */
  private async loadListingImages(ebayAccountId: string, referenceIds: Array<string | null>): Promise<Map<string, string>> {
    const ids = [...new Set(referenceIds.filter((id): id is string => !!id))];
    const images = new Map<string, string>();
    if (ids.length === 0) {
      return images;
    }
    try {
      const rows = await this.db.query<ListingImageRow>(
        `SELECT l.ebay_item_id, p.image_urls
           FROM listings l
           JOIN products p ON p.id = l.product_id
          WHERE l.ebay_account_id = $1 AND l.ebay_item_id = ANY($2::text[])`,
        [ebayAccountId, ids]
      );
      for (const row of rows) {
        const url = firstImageUrl(row.image_urls);
        if (row.ebay_item_id && url) {
          images.set(row.ebay_item_id, url);
        }
      }
    } catch (error: unknown) {
      this.logger.warn(`Conversation images unavailable for eBay account ${ebayAccountId}: ${errorText(error)}`);
    }
    return images;
  }

  async getThread(userId: string, conversationId: string, q: ThreadQuery): Promise<EbayConversationThreadDto> {
    const account = await this.loadAccount(userId, q.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(q.ebayAccountId);
    const result = await this.call(account, () =>
      this.client.getConversation(
        token,
        conversationId,
        q.type,
        { limit: q.limit, offset: (q.page - 1) * q.limit },
        EbayCallPriority.INTERACTIVE
      )
    );
    return {
      ...result.conversation,
      messages: result.messages,
      total: result.total,
      page: q.page,
      limit: q.limit,
    };
  }

  async reply(userId: string, conversationId: string, input: EbayReplyMessage): Promise<EbaySendMessageResultDto> {
    if (input.type === EbayConversationType.FROM_EBAY) {
      throw new Error(MESSAGING_ERRORS.REPLY_NOT_ALLOWED);
    }
    const text = input.text.trim();
    if (text.length > EBAY_MESSAGE_MAX_LENGTH) {
      throw new Error(MESSAGING_ERRORS.TOO_LONG);
    }
    const account = await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    return this.call(account, () => this.client.sendMessage(token, { conversationId, text }, EbayCallPriority.INTERACTIVE));
  }

  async setRead(userId: string, conversationId: string, input: EbayConversationRead): Promise<void> {
    const account = await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    await this.call(account, () =>
      this.client.updateRead(token, conversationId, input.type, input.read, EbayCallPriority.INTERACTIVE)
    );
    // A best guess until the next recount: one conversation moved across the line.
    const adjust = input.read
      ? 'unread_message_count = GREATEST(0, unread_message_count - 1)'
      : 'unread_message_count = unread_message_count + 1';
    await this.db.query(`UPDATE ebay_accounts SET ${adjust} WHERE id = $1`, [input.ebayAccountId]);
    if (input.read) {
      // Close this conversation's counting window: the webhook adds +1 only
      // while no 'counted' event exists for it, so without this the buyer's
      // next reply after an in-app read would never reach the badge.
      await this.db.query(
        "UPDATE ebay_notification_events SET outcome = 'counted_read' WHERE ebay_account_id = $1 AND conversation_id = $2 AND outcome = 'counted'",
        [input.ebayAccountId, conversationId]
      );
    }
  }

  /**
   * ARCHIVE/DELETE leave the counter alone on purpose — whether an archived
   * conversation was unread is not known here; the next recount corrects it.
   */
  async bulkStatus(
    userId: string,
    input: EbayBulkConversationStatus
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const account = await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < input.conversationIds.length; i += EBAY_BULK_CONVERSATIONS_MAX) {
      const chunk = input.conversationIds.slice(i, i + EBAY_BULK_CONVERSATIONS_MAX);
      const result = await this.call(account, () =>
        this.client.bulkUpdateStatus(token, input.type, chunk, input.status, EbayCallPriority.INTERACTIVE)
      );
      succeeded.push(...result.succeeded);
      failed.push(...result.failed);
    }
    return { succeeded, failed };
  }

  /**
   * The sidebar badge. Read from the stored counters; only when nothing keeps a
   * store's counter current — the webhook is off, or that store has no
   * NEW_MESSAGE subscription — is a 15-minute-old counter recounted from eBay
   * first; a subscribed store is recounted once its counter is a day old.
   * Best-effort and at BACKGROUND priority (the badge poll is not a seller
   * action); a failed recount keeps the stored value.
   */
  async unreadCount(userId: string): Promise<EbayUnreadCountDto> {
    const rows = await this.db.query<UnreadAccountRow>(
      `SELECT id, granted_scopes, unread_message_count, unread_message_synced_at, message_subscription_id
         FROM ebay_accounts
        WHERE user_id = $1 AND status = $2
        ORDER BY created_at ASC`,
      [userId, EbayAccountStatus.ACTIVE]
    );
    const webhookOff = !this.notifications.isEnabled();
    const byAccount: EbayUnreadCountDto['byAccount'] = [];
    for (const row of rows) {
      let unread = Number(row.unread_message_count) || 0;
      const unsubscribed = webhookOff || !row.message_subscription_id;
      const maxAgeMs = unsubscribed ? UNREAD_STALE_MS : SUBSCRIBED_UNREAD_STALE_MS;
      if (hasMessagingScopes(row.granted_scopes) && isStale(row.unread_message_synced_at, maxAgeMs)) {
        try {
          unread = await this.refreshUnread(userId, row.id, EbayCallPriority.BACKGROUND);
        } catch (error: unknown) {
          this.logger.warn(`Unread recount failed for eBay account ${row.id}: ${errorText(error)}`);
        }
      }
      byAccount.push({ ebayAccountId: row.id, unread });
    }
    return { total: byAccount.reduce((sum, a) => sum + a.unread, 0), byAccount };
  }

  /**
   * Recounts one store's UNREAD conversations (both types) from eBay and stores
   * the sum. INTERACTIVE when the seller opens the page; the badge's fallback
   * recount passes BACKGROUND.
   */
  async refreshUnread(
    userId: string,
    ebayAccountId: string,
    priority: EbayCallPriority = EbayCallPriority.INTERACTIVE
  ): Promise<number> {
    return (await this.unreadBreakdown(userId, ebayAccountId, priority)).total;
  }

  /**
   * The same recount, kept per conversation type — the folder rail shows
   * "N unread" beside each type. It also stores the sum, so the sidebar badge
   * is corrected by the same two eBay calls.
   */
  async unreadBreakdown(
    userId: string,
    ebayAccountId: string,
    priority: EbayCallPriority = EbayCallPriority.INTERACTIVE
  ): Promise<EbayUnreadBreakdownDto> {
    const account = await this.loadAccount(userId, ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(ebayAccountId);
    const counts: Record<EbayConversationType, number> = {
      [EbayConversationType.FROM_MEMBERS]: 0,
      [EbayConversationType.FROM_EBAY]: 0,
    };
    for (const type of [EbayConversationType.FROM_MEMBERS, EbayConversationType.FROM_EBAY]) {
      const result = await this.call(account, () =>
        this.client.getConversations(
          token,
          { type, status: EbayConversationStatus.UNREAD, limit: 1, offset: 0 },
          priority
        )
      );
      counts[type] = result.total;
    }
    const total = counts[EbayConversationType.FROM_MEMBERS] + counts[EbayConversationType.FROM_EBAY];
    await this.db.query(
      'UPDATE ebay_accounts SET unread_message_count = $1, unread_message_synced_at = NOW() WHERE id = $2',
      [total, ebayAccountId]
    );
    return {
      total,
      members: counts[EbayConversationType.FROM_MEMBERS],
      ebay: counts[EbayConversationType.FROM_EBAY],
    };
  }

  /** Ownership (ACTIVE + this user's) and the messaging scopes, in one read. */
  private async loadAccount(userId: string, ebayAccountId: string): Promise<MessagingAccountRow> {
    const rows = await this.db.query<MessagingAccountRow>(
      'SELECT granted_scopes, ebay_username, seller_id, unread_message_count, unread_message_synced_at FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status = $3',
      [ebayAccountId, userId, EbayAccountStatus.ACTIVE]
    );
    const account = rows[0];
    if (!account) {
      throw new Error(MESSAGING_ERRORS.ACCOUNT_NOT_FOUND);
    }
    if (!hasMessagingScopes(account.granted_scopes)) {
      throw new Error(MESSAGING_ERRORS.SCOPE_MISSING);
    }
    return account;
  }

  /**
   * Maps an eBay failure to a seller-facing key:
   *  - 403 → `messagingScopeMissing` only when it really is the grant: the
   *    store row lacks the scopes, or eBay's text says scope/permission/
   *    authorization (e.g. the grant was withdrawn on eBay's side);
   *  - any other 4xx (incl. other 403s) → `messagingRejected` — eBay refused
   *    this request, not the connection;
   *  - 429 (after the client's own retries), 5xx, a non-error status or no
   *    HTTP answer at all → `messagingUnavailable`.
   */
  private async call<T>(account: MessagingAccountRow, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error: unknown) {
      if (error instanceof EbayMessageApiError) {
        const { status } = error;
        if (status === 403 && (!hasMessagingScopes(account.granted_scopes) || SCOPE_ERROR_TEXT.test(error.message))) {
          throw new Error(MESSAGING_ERRORS.SCOPE_MISSING);
        }
        if (status >= 400 && status < 500 && status !== 429) {
          this.logger.warn(`eBay Message API rejected a request (${status}): ${error.message}`);
          throw new Error(MESSAGING_ERRORS.REJECTED);
        }
        this.logger.warn(`eBay Message API unavailable (${status}): ${error.message}`);
        throw new Error(MESSAGING_ERRORS.UNAVAILABLE);
      }
      this.logger.warn(`eBay Message API call failed: ${errorText(error)}`);
      throw new Error(MESSAGING_ERRORS.UNAVAILABLE);
    }
  }
}

/**
 * The buyer on a row: the latest message's sender unless that is the store
 * itself (by username or immutable id), otherwise its recipient.
 */
function resolveOtherParty(item: EbayConversationDto, account: MessagingAccountRow): string | null {
  const latest = item.latestMessage;
  if (!latest) {
    return null;
  }
  const self = new Set(
    [account.ebay_username, account.seller_id].filter((v): v is string => !!v).map((v) => v.toLowerCase())
  );
  const sender = latest.senderUsername;
  if (sender && !self.has(sender.toLowerCase())) {
    return sender;
  }
  return latest.recipientUsername || null;
}

/** First photo of `products.image_urls`, tolerating a legacy JSON-string row. */
function firstImageUrl(raw: string[] | string | null): string | null {
  let urls: unknown = raw;
  if (typeof raw === 'string') {
    try {
      urls = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const first: unknown = Array.isArray(urls) ? urls[0] : null;
  return typeof first === 'string' && first !== '' ? first : null;
}

function isStale(syncedAt: Date | null, maxAgeMs: number): boolean {
  if (!syncedAt) {
    return true;
  }
  const at = syncedAt instanceof Date ? syncedAt.getTime() : new Date(syncedAt).getTime();
  return !Number.isFinite(at) || Date.now() - at > maxAgeMs;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
