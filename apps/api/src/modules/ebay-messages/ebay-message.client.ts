import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EBAY_CONVERSATIONS_MAX_LIMIT,
  EbayApiResource,
  EbayCallPriority,
  EbayConversationDto,
  EbayConversationMutableStatus,
  EbayConversationStatus,
  EbayConversationThreadDto,
  EbayConversationType,
  EbayMessageDto,
  EbayMessageMediaDto,
} from '@repo/shared';
import axios, { AxiosResponse } from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay/ebay-http-retry';

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_REST_BASE = 'https://api.ebay.com';
/** eBay's `reference_type` / `reference.referenceType` — the only kind we send is a listing. */
const LISTING_REFERENCE_TYPE = 'LISTING';
/** `bulk_update_conversation`'s per-entry success value. */
const BULK_UPDATE_SUCCESSFUL = 'SUCCESSFUL';

/** eBay answered a Message API call with an error — carries its numeric error ids. */
export class EbayMessageApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorIds: number[],
    message: string
  ) {
    super(message);
    this.name = 'EbayMessageApiError';
  }
}

export interface ConversationListResult {
  items: EbayConversationDto[];
  total: number;
}

export interface ThreadResult {
  conversation: Pick<EbayConversationThreadDto, 'conversationId' | 'type' | 'status' | 'title'>;
  messages: EbayMessageDto[];
  total: number;
}

export interface ConversationListQuery {
  type: EbayConversationType;
  status?: EbayConversationStatus;
  limit: number;
  offset: number;
  referenceId?: string;
  otherPartyUsername?: string;
}

export interface SendMessageInput {
  conversationId?: string;
  otherPartyUsername?: string;
  text: string;
  referenceItemId?: string;
}

interface EbayErrorBody {
  errors?: Array<{ errorId?: unknown; message?: unknown }>;
}

interface HttpErrorLike {
  response?: { status?: number; data?: unknown };
}

type RawRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is RawRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asNullableString = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const asCount = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const CONVERSATION_TYPES = new Set<string>(Object.values(EbayConversationType));
const CONVERSATION_STATUSES = new Set<string>(Object.values(EbayConversationStatus));

function asConversationType(v: unknown, fallback: EbayConversationType): EbayConversationType {
  return typeof v === 'string' && CONVERSATION_TYPES.has(v) ? (v as EbayConversationType) : fallback;
}

/**
 * getConversations' `conversation_status` takes `ARCHIVED` / `DELETED`, not the
 * documented `ARCHIVE` / `DELETE` (those answer 400 errorId 355001 — production,
 * 2026-10-07). Read filters only; the update calls are left on the documented values.
 */
const READ_STATUS_TO_EBAY: Partial<Record<EbayConversationStatus, string>> = {
  [EbayConversationStatus.ARCHIVE]: 'ARCHIVED',
  [EbayConversationStatus.DELETE]: 'DELETED',
};
const READ_STATUS_FROM_EBAY: Record<string, EbayConversationStatus> = {
  ARCHIVED: EbayConversationStatus.ARCHIVE,
  DELETED: EbayConversationStatus.DELETE,
};

/** eBay ignores `conversation_status=UNREAD` on FROM_EBAY (returns every conversation), so unread is read from `unreadCount`. */
const UNREAD_SCAN_MAX_PAGES = 20;

function asConversationStatus(v: unknown): EbayConversationStatus {
  if (typeof v === 'string' && READ_STATUS_FROM_EBAY[v]) {
    return READ_STATUS_FROM_EBAY[v];
  }
  return typeof v === 'string' && CONVERSATION_STATUSES.has(v) ? (v as EbayConversationStatus) : EbayConversationStatus.ACTIVE;
}

function clampLimit(limit: number): number {
  const n = Number.isFinite(limit) ? Math.floor(limit) : EBAY_CONVERSATIONS_MAX_LIMIT;
  return Math.min(Math.max(n, 1), EBAY_CONVERSATIONS_MAX_LIMIT);
}

function clampOffset(offset: number): number {
  return Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
}

function mapMedia(raw: unknown): EbayMessageMediaDto | null {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    mediaName: asString(raw.mediaName),
    mediaType: asString(raw.mediaType),
    mediaUrl: asString(raw.mediaUrl),
  };
}

/** eBay `MessageDetail` → our DTO. Total over unknown input: null when there is no string `messageId`. */
export function mapMessage(raw: unknown): EbayMessageDto | null {
  if (!isRecord(raw) || typeof raw.messageId !== 'string') {
    return null;
  }
  const media = Array.isArray(raw.messageMedia)
    ? raw.messageMedia.map(mapMedia).filter((m): m is EbayMessageMediaDto => m !== null)
    : [];
  return {
    messageId: raw.messageId,
    subject: asNullableString(raw.subject),
    body: asString(raw.messageBody),
    senderUsername: asString(raw.senderUsername),
    recipientUsername: asString(raw.recipientUsername),
    read: raw.readStatus === true,
    createdAt: asString(raw.createdDate),
    media,
  };
}

/**
 * eBay `Conversation` → our DTO. Total over unknown input: null when there is
 * no string `conversationId`.
 *
 * `otherPartyUsername` is always `null` here: which side of a thread is the
 * seller can only be decided with the seller's own eBay username, which this
 * client does not know. The service fills it.
 */
export function mapConversation(raw: unknown): EbayConversationDto | null {
  if (!isRecord(raw) || typeof raw.conversationId !== 'string') {
    return null;
  }
  return {
    conversationId: raw.conversationId,
    type: asConversationType(raw.conversationType, EbayConversationType.FROM_MEMBERS),
    status: asConversationStatus(raw.conversationStatus),
    title: asNullableString(raw.conversationTitle),
    unreadCount: asCount(raw.unreadCount),
    referenceType: asNullableString(raw.referenceType),
    referenceId: asNullableString(raw.referenceId),
    createdAt: asString(raw.createdDate),
    latestMessage: mapMessage(raw.latestMessage),
    otherPartyUsername: null,
    imageUrl: null,
  };
}

/**
 * eBay Commerce Message API (`/commerce/message/v1`) — the seller's own
 * buyer↔seller and eBay-to-seller conversations, called with that seller's
 * USER token.
 *
 * Every request charges `EbayApiResource.MESSAGE` at the caller's priority
 * before each attempt (a retry is a real call eBay counts). `conversation_type`
 * is sent on every read because eBay requires it, and `limit` is clamped to
 * eBay's own maximum of 50.
 */
@Injectable()
export class EbayMessageClient {
  private readonly logger = new Logger(EbayMessageClient.name);

  constructor(
    private readonly budget: EbayCallBudgetService,
    private readonly config: ConfigService
  ) {}

  async getConversations(
    token: string,
    q: ConversationListQuery,
    priority: EbayCallPriority
  ): Promise<ConversationListResult> {
    if (q.status === EbayConversationStatus.UNREAD && q.type === EbayConversationType.FROM_EBAY) {
      return this.scanUnread(token, q, priority);
    }
    const params: Record<string, string | number> = {
      conversation_type: q.type,
      limit: clampLimit(q.limit),
      offset: clampOffset(q.offset),
    };
    if (q.status) {
      params.conversation_status = READ_STATUS_TO_EBAY[q.status] ?? q.status;
    }
    if (q.referenceId) {
      params.reference_type = LISTING_REFERENCE_TYPE;
      params.reference_id = q.referenceId;
    }
    if (q.otherPartyUsername) {
      params.other_party_username = q.otherPartyUsername;
    }

    const res = await this.request(
      () => axios.get<unknown>(`${this.base()}/conversation`, { ...this.options(token), params }),
      priority
    );
    const data = isRecord(res.data) ? res.data : {};
    const items = (Array.isArray(data.conversations) ? data.conversations : [])
      .map(mapConversation)
      .filter((c): c is EbayConversationDto => c !== null);
    const total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : items.length;
    return { items, total };
  }

  /**
   * Unread FROM_EBAY conversations: every active page read, those with
   * `unreadCount > 0` kept, then paged locally. ~7 calls for 300 conversations
   * on the 500,000/day Message pool.
   * ponytail: capped at 20 pages (1,000 conversations); an older unread notice past that is not counted.
   */
  private async scanUnread(
    token: string,
    q: ConversationListQuery,
    priority: EbayCallPriority
  ): Promise<ConversationListResult> {
    const unread: EbayConversationDto[] = [];
    let offset = 0;
    for (let pageIndex = 0; pageIndex < UNREAD_SCAN_MAX_PAGES; pageIndex++) {
      const page = await this.getConversations(
        token,
        { type: q.type, limit: EBAY_CONVERSATIONS_MAX_LIMIT, offset },
        priority
      );
      unread.push(...page.items.filter((item) => item.unreadCount > 0));
      offset += page.items.length;
      if (page.items.length === 0 || offset >= page.total) {
        break;
      }
    }
    const start = clampOffset(q.offset);
    return { items: unread.slice(start, start + clampLimit(q.limit)), total: unread.length };
  }

  async getConversation(
    token: string,
    id: string,
    type: EbayConversationType,
    page: { limit: number; offset: number },
    priority: EbayCallPriority
  ): Promise<ThreadResult> {
    const params = {
      conversation_type: type,
      limit: clampLimit(page.limit),
      offset: clampOffset(page.offset),
    };
    const res = await this.request(
      () =>
        axios.get<unknown>(`${this.base()}/conversation/${encodeURIComponent(id)}`, {
          ...this.options(token),
          params,
        }),
      priority
    );
    const data = isRecord(res.data) ? res.data : {};
    const messages = (Array.isArray(data.messages) ? data.messages : [])
      .map(mapMessage)
      .filter((m): m is EbayMessageDto => m !== null);
    const total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : messages.length;
    return {
      conversation: {
        conversationId: id,
        type: asConversationType(data.conversationType, type),
        status: asConversationStatus(data.conversationStatus),
        title: asNullableString(data.conversationTitle),
      },
      messages,
      total,
    };
  }

  async sendMessage(token: string, input: SendMessageInput, priority: EbayCallPriority): Promise<{ messageId: string }> {
    const body: Record<string, unknown> = {};
    if (input.conversationId) {
      body.conversationId = input.conversationId;
    }
    if (input.otherPartyUsername) {
      body.otherPartyUsername = input.otherPartyUsername;
    }
    body.messageText = input.text;
    if (input.referenceItemId) {
      body.reference = { referenceType: LISTING_REFERENCE_TYPE, referenceId: input.referenceItemId };
    }

    const res = await this.request(
      () => axios.post<unknown>(`${this.base()}/send_message`, body, this.options(token)),
      priority
    );
    const messageId = isRecord(res.data) ? asString(res.data.messageId) : '';
    if (!messageId) {
      throw new EbayMessageApiError(res.status, [], 'eBay accepted send_message but returned no messageId');
    }
    return { messageId };
  }

  async updateRead(
    token: string,
    id: string,
    type: EbayConversationType,
    read: boolean,
    priority: EbayCallPriority
  ): Promise<void> {
    await this.request(
      () =>
        axios.post<unknown>(
          `${this.base()}/update_conversation`,
          { conversationId: id, conversationType: type, read },
          this.options(token)
        ),
      priority
    );
  }

  /**
   * Sets one status on several conversations. Any id eBay did not report back
   * as SUCCESSFUL counts as failed — an absent entry is never a success.
   */
  async bulkUpdateStatus(
    token: string,
    type: EbayConversationType,
    ids: string[],
    status: EbayConversationMutableStatus,
    priority: EbayCallPriority
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    const res = await this.request(
      () =>
        axios.post<unknown>(
          `${this.base()}/bulk_update_conversation`,
          {
            conversations: ids.map((id) => ({ conversationId: id, conversationType: type, conversationStatus: status })),
          },
          this.options(token)
        ),
      priority
    );
    const data = isRecord(res.data) ? res.data : {};
    const ok = new Set<string>();
    for (const entry of Array.isArray(data.conversations) ? data.conversations : []) {
      if (isRecord(entry) && entry.updateStatus === BULK_UPDATE_SUCCESSFUL && typeof entry.conversationId === 'string') {
        ok.add(entry.conversationId);
      }
    }
    return {
      succeeded: ids.filter((id) => ok.has(id)),
      failed: ids.filter((id) => !ok.has(id)),
    };
  }

  private base(): string {
    const configured = this.config.get<string>('EBAY_REST_API_URL')?.trim();
    return `${(configured || DEFAULT_REST_BASE).replace(/\/+$/, '')}/commerce/message/v1`;
  }

  private options(token: string): { headers: Record<string, string>; timeout: number } {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    };
  }

  /** Budget + 429/5xx backoff; an HTTP error becomes an `EbayMessageApiError` carrying eBay's ids. */
  private async request<T>(run: () => Promise<AxiosResponse<T>>, priority: EbayCallPriority): Promise<AxiosResponse<T>> {
    try {
      return await withEbayRateLimitRetry(run, {
        logger: this.logger,
        acquireBudget: () => this.budget.acquire(EbayApiResource.MESSAGE, priority),
      });
    } catch (error: unknown) {
      const httpError = error as HttpErrorLike;
      const status = httpError?.response?.status;
      if (typeof status !== 'number') {
        throw error;
      }
      const body = (isRecord(httpError.response?.data) ? httpError.response?.data : {}) as EbayErrorBody;
      const errors = Array.isArray(body.errors) ? body.errors : [];
      const ids = errors.map((e) => Number(e?.errorId)).filter(Number.isFinite);
      const message =
        errors
          .map((e) => asString(e?.message))
          .filter(Boolean)
          .join('; ') || `eBay Message API ${status}`;
      throw new EbayMessageApiError(status, ids, message);
    }
  }
}
