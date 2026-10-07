// apps/api/src/modules/ebay-returns/post-order.client.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay/ebay-http-retry';

import {
  CANCELLATION_SEARCH_LIMIT,
  CANCELLATION_SEARCH_ROLE,
  CANCELLATION_SEARCH_SORT,
  RETURN_SEARCH_LIMIT,
  RETURN_SEARCH_SORT,
} from './ebay-returns.constants';
import type {
  CancellationSearchParams,
  PostOrderCancellationDetail,
  PostOrderCancellationSearchResponse,
  PostOrderCancellationSummary,
  PostOrderDecideReturnRequest,
  PostOrderIssueRefundRequest,
  PostOrderMarkReceivedRequest,
  PostOrderPaginationOutput,
  PostOrderProvideLabelRequest,
  PostOrderRefundStatusResponse,
  PostOrderRejectCancelRequest,
  PostOrderReturnDetail,
  PostOrderReturnSearchResponse,
  PostOrderReturnSummary,
  PostOrderUploadFileRequest,
  ReturnSearchParams,
} from './post-order.types';

const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_REST_BASE = 'https://api.ebay.com';

/**
 * The Post-Order token prefix. eBay's "Making a Call" page: "OAuth – Prefix a
 * valid User access token with the string "IAF " (with a space)." This is NOT
 * the prefix the other eBay REST APIs take.
 */
const POST_ORDER_AUTH_PREFIX = 'IAF ';

/** eBay answered 200 with a body that is not the documented JSON object. */
export class PostOrderResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostOrderResponseError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** eBay refused a Post-Order call with a 4xx — the return is not in a state that allows it, or the body was wrong. */
export class PostOrderRejectedError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PostOrderRejectedError';
  }
}

/**
 * eBay Post-Order API, for returns and buyer cancellation requests. Nine
 * calls, every one documented in docs/ebay-reference/post-order/:
 * - `GET  /post-order/v2/return/search`               — the sweep (BACKGROUND)
 * - `GET  /post-order/v2/return/{returnId}`           — the detail pane (INTERACTIVE)
 * - `POST /post-order/v2/return/{returnId}/decide`           (APPROVE only)
 * - `POST /post-order/v2/return/{returnId}/mark_as_received`
 * - `POST /post-order/v2/return/{returnId}/issue_refund`
 * - `GET  /post-order/v2/cancellation/search?role=SELLER` — the sweep (BACKGROUND)
 * - `GET  /post-order/v2/cancellation/{cancelId}`     — the live read before an answer (INTERACTIVE)
 * - `POST /post-order/v2/cancellation/{cancelId}/approve`    (no payload)
 * - `POST /post-order/v2/cancellation/{cancelId}/reject`     (`{}` or shipment date + tracking)
 *
 * The five writes settle a buyer's claim, cancel a real order or move real
 * money on a real seller's store, so they are reachable only through
 * `EbayReturnsActionsService` / `EbayCancellationsActionsService` (operator
 * switch, live check, audit row); `ebay-returns.guard.spec.ts` keeps every
 * other path out of here. A write is sent ONCE — never inside
 * `withEbayRateLimitRetry`: a refund replayed after a timeout eBay had in
 * fact processed would be a second refund.
 *
 * Quota: `post-order.return` and `post-order.cancellation` are 5,000 calls a
 * day EACH for the WHOLE application (production `getRateLimits`,
 * 2026-09-30), so every attempt is charged to its own resource before it goes
 * out — a sweep at BACKGROUND priority, a seller's own read or action at
 * INTERACTIVE. `EbayBudgetExhaustedError` propagates to the caller.
 */
@Injectable()
export class PostOrderClient {
  private readonly logger = new Logger(PostOrderClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly budget: EbayCallBudgetService
  ) {}

  /**
   * One page of a seller's return requests, newest first.
   *
   * DOCUMENTED LIMITATION — only the first page (200 entries) is read, and
   * `offset` is deliberately never sent. eBay's reference contradicts itself
   * about what it means: the query parameter is described as "the number of
   * entries to skip" and, in the next sentence, as "a positive value equal to
   * or lower than the number of pages available", while the reference's own
   * response sample answers `"offset": 1` for a first page. Paging on a guess
   * could silently skip or repeat returns, so the sweep asks for the
   * documented maximum (`limit=200`) sorted newest-first (`sort=-FILING_DATE`)
   * and the caller logs a warning when `paginationOutput.totalEntries` says
   * more exist. A store with more than 200 returns inside the search window
   * therefore has its OLDEST ones unread until the offset semantics are
   * observed live.
   */
  async searchReturns(
    accessToken: string,
    marketplaceId: string,
    params: ReturnSearchParams
  ): Promise<PostOrderReturnSearchResponse> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<unknown>(`${this.baseUrl()}/post-order/v2/return/search`, {
          headers: this.headers(accessToken, marketplaceId),
          params: {
            creation_date_range_from: params.creationDateFrom,
            limit: RETURN_SEARCH_LIMIT,
            sort: RETURN_SEARCH_SORT,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      { logger: this.logger, acquireBudget: this.charge(EbayApiResource.POST_ORDER_RETURN) }
    );

    const body: unknown = response.data;
    if (!isRecord(body)) {
      // Never read as "this seller has no returns": the caller must see a
      // failure, not an empty list.
      throw new PostOrderResponseError('eBay return search answered with a body that is not a JSON object');
    }

    // "This array is returned as empty if no return requests match the filter
    // criteria in the request." Entries that are not objects are dropped.
    const members = (Array.isArray(body.members) ? body.members : []).filter(
      (member): member is PostOrderReturnSummary => isRecord(member)
    );
    const paginationOutput: PostOrderPaginationOutput | undefined = isRecord(body.paginationOutput)
      ? body.paginationOutput
      : undefined;

    return { members, paginationOutput };
  }

  /**
   * One return in full (`fieldgroups=FULL` is the documented default: the
   * `detail` container only). A body without `detail` is an error, never an
   * empty return.
   */
  async getReturn(accessToken: string, marketplaceId: string, returnId: string): Promise<PostOrderReturnDetail> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<unknown>(`${this.baseUrl()}/post-order/v2/return/${encodeURIComponent(returnId)}`, {
          headers: this.headers(accessToken, marketplaceId),
          params: { fieldgroups: 'FULL' },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      {
        logger: this.logger,
        acquireBudget: this.charge(EbayApiResource.POST_ORDER_RETURN, EbayCallPriority.INTERACTIVE),
      }
    );
    const body: unknown = response.data;
    if (!isRecord(body) || !isRecord(body.detail)) {
      throw new PostOrderResponseError('eBay return detail answered without a `detail` container');
    }
    return body.detail as PostOrderReturnDetail;
  }

  /** `decide` with `APPROVE` — "The seller must approve all buyer-initiated return requests before they are allowed." */
  async decideReturn(
    accessToken: string,
    marketplaceId: string,
    returnId: string,
    body: PostOrderDecideReturnRequest
  ): Promise<PostOrderRefundStatusResponse> {
    return this.write(
      EbayApiResource.POST_ORDER_RETURN,
      accessToken,
      marketplaceId,
      `/post-order/v2/return/${encodeURIComponent(returnId)}/decide`,
      body
    );
  }

  /** "This method can be used on behalf of a seller to mark a return item as received." No response payload. */
  async markReturnReceived(
    accessToken: string,
    marketplaceId: string,
    returnId: string,
    body: PostOrderMarkReceivedRequest
  ): Promise<void> {
    await this.write(
      EbayApiResource.POST_ORDER_RETURN,
      accessToken,
      marketplaceId,
      `/post-order/v2/return/${encodeURIComponent(returnId)}/mark_as_received`,
      body
    );
  }

  /** "Issue a refund for a returned item." */
  async issueReturnRefund(
    accessToken: string,
    marketplaceId: string,
    returnId: string,
    body: PostOrderIssueRefundRequest
  ): Promise<PostOrderRefundStatusResponse> {
    return this.write(
      EbayApiResource.POST_ORDER_RETURN,
      accessToken,
      marketplaceId,
      `/post-order/v2/return/${encodeURIComponent(returnId)}/issue_refund`,
      body
    );
  }

  /**
   * "Upload the files relating to a return request" — here only the seller's
   * own return label (`LABEL_RELATED`). Answers the `fileId` eBay assigned;
   * a 2xx without one is a response error, never an empty id.
   */
  async uploadReturnFile(
    accessToken: string,
    marketplaceId: string,
    returnId: string,
    body: PostOrderUploadFileRequest
  ): Promise<string> {
    const data = await this.writeRaw(
      EbayApiResource.POST_ORDER_RETURN,
      accessToken,
      marketplaceId,
      `/post-order/v2/return/${encodeURIComponent(returnId)}/file/upload`,
      body
    );
    const fileId = isRecord(data) && typeof data.fileId === 'string' ? data.fileId.trim() : '';
    if (!fileId) {
      throw new PostOrderResponseError('eBay accepted the label file but answered no fileId');
    }
    return fileId;
  }

  /**
   * "Create or update a return shipping label provided by the seller" —
   * the seller's uploaded label (`UPLOAD_LABEL`) or "already sent" (`MARK_AS_SENT`).
   */
  async addReturnShippingLabel(
    accessToken: string,
    marketplaceId: string,
    returnId: string,
    body: PostOrderProvideLabelRequest
  ): Promise<void> {
    await this.writeRaw(
      EbayApiResource.POST_ORDER_RETURN,
      accessToken,
      marketplaceId,
      `/post-order/v2/return/${encodeURIComponent(returnId)}/add_shipping_label`,
      body
    );
  }

  /**
   * The buyer cancellation requests of one store, newest first, first page
   * only (`limit=500`, the documented maximum). `role` is the caller's role,
   * `SELLER`, and `creation_date_range_to` is required — both measured on
   * production (see the constants). `offset` is documented here as
   * plain "number of entries to skip" but is not sent — a store with more than
   * 500 buyer requests in 90 days is logged by the caller, not paged.
   */
  async searchCancellations(
    accessToken: string,
    marketplaceId: string,
    params: CancellationSearchParams
  ): Promise<PostOrderCancellationSearchResponse> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<unknown>(`${this.baseUrl()}/post-order/v2/cancellation/search`, {
          headers: this.headers(accessToken, marketplaceId),
          params: {
            creation_date_range_from: params.creationDateFrom,
            creation_date_range_to: params.creationDateTo,
            role: CANCELLATION_SEARCH_ROLE,
            limit: CANCELLATION_SEARCH_LIMIT,
            sort: CANCELLATION_SEARCH_SORT,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      { logger: this.logger, acquireBudget: this.charge(EbayApiResource.POST_ORDER_CANCELLATION) }
    );

    const body: unknown = response.data;
    if (!isRecord(body)) {
      throw new PostOrderResponseError('eBay cancellation search answered with a body that is not a JSON object');
    }
    // "This array is returned as empty if no order cancellation requests match the input criteria."
    const cancellations = (Array.isArray(body.cancellations) ? body.cancellations : []).filter(
      (entry): entry is PostOrderCancellationSummary => isRecord(entry)
    );
    const paginationOutput: PostOrderPaginationOutput | undefined = isRecord(body.paginationOutput)
      ? body.paginationOutput
      : undefined;
    return { cancellations, paginationOutput };
  }

  /** One request in full (`fieldgroups=FULL`, the documented default → `cancelDetail`). */
  async getCancellation(
    accessToken: string,
    marketplaceId: string,
    cancelId: string
  ): Promise<PostOrderCancellationDetail> {
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<unknown>(`${this.baseUrl()}/post-order/v2/cancellation/${encodeURIComponent(cancelId)}`, {
          headers: this.headers(accessToken, marketplaceId),
          params: { fieldgroups: 'FULL' },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      {
        logger: this.logger,
        acquireBudget: this.charge(EbayApiResource.POST_ORDER_CANCELLATION, EbayCallPriority.INTERACTIVE),
      }
    );
    const body: unknown = response.data;
    if (!isRecord(body) || !isRecord(body.cancelDetail)) {
      throw new PostOrderResponseError('eBay cancellation detail answered without a `cancelDetail` container');
    }
    return body.cancelDetail as PostOrderCancellationDetail;
  }

  /** "This method has no request or response payloads" — HTTP 200 means the order is cancelled. */
  async approveCancellation(accessToken: string, marketplaceId: string, cancelId: string): Promise<void> {
    await this.write(
      EbayApiResource.POST_ORDER_CANCELLATION,
      accessToken,
      marketplaceId,
      `/post-order/v2/cancellation/${encodeURIComponent(cancelId)}/approve`,
      undefined
    );
  }

  /** No response payload. The body is `{}` unless the order shipped (see `PostOrderRejectCancelRequest`). */
  async rejectCancellation(
    accessToken: string,
    marketplaceId: string,
    cancelId: string,
    body: PostOrderRejectCancelRequest
  ): Promise<void> {
    await this.write(
      EbayApiResource.POST_ORDER_CANCELLATION,
      accessToken,
      marketplaceId,
      `/post-order/v2/cancellation/${encodeURIComponent(cancelId)}/reject`,
      body
    );
  }

  /**
   * One attempt, charged first, never retried (see the class comment). A 4xx
   * is eBay's refusal (`PostOrderRejectedError`, the status kept, the body
   * logged at warn without the request); anything else propagates as the
   * transport error it is.
   */
  private async write(
    resource: EbayApiResource,
    accessToken: string,
    marketplaceId: string,
    path: string,
    body: unknown
  ): Promise<PostOrderRefundStatusResponse> {
    const data = await this.writeRaw(resource, accessToken, marketplaceId, path, body);
    return isRecord(data) && typeof data.refundStatus === 'string' ? { refundStatus: data.refundStatus } : {};
  }

  /** `write`, answering eBay's body as it came. */
  private async writeRaw(
    resource: EbayApiResource,
    accessToken: string,
    marketplaceId: string,
    path: string,
    body: unknown
  ): Promise<unknown> {
    await this.charge(resource, EbayCallPriority.INTERACTIVE)();
    try {
      const response = await axios.post<unknown>(`${this.baseUrl()}${path}`, body, {
        headers: this.headers(accessToken, marketplaceId),
        timeout: REQUEST_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
        const status = error.response.status;
        this.logger.warn(
          `eBay refused ${path.replace(
            /^(\/post-order\/v2\/\w+\/)[^/]+/,
            '$1{id}'
          )} with HTTP ${status}: ${describeErrorBody(error.response.data)}`
        );
        throw new PostOrderRejectedError(`eBay refused the Post-Order call with HTTP ${status}`, status);
      }
      throw error;
    }
  }

  private headers(accessToken: string, marketplaceId: string): Record<string, string> {
    return {
      Authorization: `${POST_ORDER_AUTH_PREFIX}${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * eBay's reference for this call — and for every cancellation call: "This
   * method is not supported in the Sandbox environment." A deployment on sandbox keys (local dev, the test
   * stack) therefore has nothing to ask — the sweep checks this before it
   * claims a store, so no watermark is stamped and no call is spent.
   */
  isReturnSearchSupported(): boolean {
    return this.config.get<string>('EBAY_ENVIRONMENT')?.trim().toLowerCase() !== 'sandbox';
  }

  /** Same value every other eBay REST client resolves (`EBAY_REST_API_URL`). */
  private baseUrl(): string {
    return this.config.get<string>('EBAY_REST_API_URL') || DEFAULT_REST_BASE;
  }

  private charge(
    resource: EbayApiResource,
    priority: EbayCallPriority = EbayCallPriority.BACKGROUND
  ): () => Promise<void> {
    return async () => {
      await this.budget.acquire(resource, priority);
    };
  }
}

/**
 * eBay's error envelope for the log line: the `errorId` / `message` pairs
 * only — never the whole body, which can echo the request (a comment, an
 * amount) back.
 */
function describeErrorBody(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.errors)) {
    return 'no error body';
  }
  return data.errors
    .filter(isRecord)
    .map((e) => `${String(e.errorId ?? '?')} ${String(e.message ?? '')}`.trim())
    .join('; ')
    .slice(0, 300);
}
