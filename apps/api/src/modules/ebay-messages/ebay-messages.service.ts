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
  TOO_LONG: 'ebay.errors.messageTooLong',
} as const;

/**
 * Without the NEW_MESSAGE webhook nothing keeps the stored counter current, so
 * the badge read recounts a store from eBay once its counter is older than this.
 */
const UNREAD_STALE_MS = 15 * 60 * 1000;

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
    const result = await this.call(() =>
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
    return {
      items: result.items.map((item) => ({ ...item, otherPartyUsername: resolveOtherParty(item, account) })),
      total: result.total,
      page: q.page,
      limit: q.limit,
    };
  }

  async getThread(userId: string, conversationId: string, q: ThreadQuery): Promise<EbayConversationThreadDto> {
    await this.loadAccount(userId, q.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(q.ebayAccountId);
    const result = await this.call(() =>
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
    await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    return this.call(() => this.client.sendMessage(token, { conversationId, text }, EbayCallPriority.INTERACTIVE));
  }

  async setRead(userId: string, conversationId: string, input: EbayConversationRead): Promise<void> {
    await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    await this.call(() =>
      this.client.updateRead(token, conversationId, input.type, input.read, EbayCallPriority.INTERACTIVE)
    );
    // A best guess until the next recount: one conversation moved across the line.
    const adjust = input.read
      ? 'unread_message_count = GREATEST(0, unread_message_count - 1)'
      : 'unread_message_count = unread_message_count + 1';
    await this.db.query(`UPDATE ebay_accounts SET ${adjust} WHERE id = $1`, [input.ebayAccountId]);
  }

  /**
   * ARCHIVE/DELETE leave the counter alone on purpose — whether an archived
   * conversation was unread is not known here; the next recount corrects it.
   */
  async bulkStatus(
    userId: string,
    input: EbayBulkConversationStatus
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    await this.loadAccount(userId, input.ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < input.conversationIds.length; i += EBAY_BULK_CONVERSATIONS_MAX) {
      const chunk = input.conversationIds.slice(i, i + EBAY_BULK_CONVERSATIONS_MAX);
      const result = await this.call(() =>
        this.client.bulkUpdateStatus(token, input.type, chunk, input.status, EbayCallPriority.INTERACTIVE)
      );
      succeeded.push(...result.succeeded);
      failed.push(...result.failed);
    }
    return { succeeded, failed };
  }

  /**
   * The sidebar badge. Read from the stored counters; only when the webhook is
   * off (so nothing keeps them current) is a store whose counter is stale
   * recounted from eBay first — best-effort, a failed recount keeps the stored
   * value.
   */
  async unreadCount(userId: string): Promise<EbayUnreadCountDto> {
    const rows = await this.db.query<UnreadAccountRow>(
      `SELECT id, granted_scopes, unread_message_count, unread_message_synced_at
         FROM ebay_accounts
        WHERE user_id = $1 AND status = $2
        ORDER BY created_at ASC`,
      [userId, EbayAccountStatus.ACTIVE]
    );
    const recount = !this.notifications.isEnabled();
    const byAccount: EbayUnreadCountDto['byAccount'] = [];
    for (const row of rows) {
      let unread = Number(row.unread_message_count) || 0;
      if (recount && hasMessagingScopes(row.granted_scopes) && isStale(row.unread_message_synced_at)) {
        try {
          unread = await this.refreshUnread(userId, row.id);
        } catch (error: unknown) {
          this.logger.warn(`Unread recount failed for eBay account ${row.id}: ${errorText(error)}`);
        }
      }
      byAccount.push({ ebayAccountId: row.id, unread });
    }
    return { total: byAccount.reduce((sum, a) => sum + a.unread, 0), byAccount };
  }

  /** Recounts one store's UNREAD conversations (both types) from eBay and stores the sum. */
  async refreshUnread(userId: string, ebayAccountId: string): Promise<number> {
    await this.loadAccount(userId, ebayAccountId);
    const token = await this.ebayService.getAccountAccessToken(ebayAccountId);
    let unread = 0;
    for (const type of [EbayConversationType.FROM_MEMBERS, EbayConversationType.FROM_EBAY]) {
      const result = await this.call(() =>
        this.client.getConversations(
          token,
          { type, status: EbayConversationStatus.UNREAD, limit: 1, offset: 0 },
          EbayCallPriority.INTERACTIVE
        )
      );
      unread += result.total;
    }
    await this.db.query(
      'UPDATE ebay_accounts SET unread_message_count = $1, unread_message_synced_at = NOW() WHERE id = $2',
      [unread, ebayAccountId]
    );
    return unread;
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
   * A 403 means the token lacks the scope (the row said otherwise — e.g. the
   * grant was withdrawn on eBay's side); a 5xx or a failure with no HTTP answer
   * is eBay being unavailable. Any other eBay 4xx is rethrown unchanged.
   */
  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error: unknown) {
      if (error instanceof EbayMessageApiError) {
        if (error.status === 403) {
          throw new Error(MESSAGING_ERRORS.SCOPE_MISSING);
        }
        if (error.status >= 500) {
          this.logger.warn(`eBay Message API unavailable: ${error.message}`);
          throw new Error(MESSAGING_ERRORS.UNAVAILABLE);
        }
        throw error;
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

function isStale(syncedAt: Date | null): boolean {
  if (!syncedAt) {
    return true;
  }
  const at = syncedAt instanceof Date ? syncedAt.getTime() : new Date(syncedAt).getTime();
  return !Number.isFinite(at) || Date.now() - at > UNREAD_STALE_MS;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
