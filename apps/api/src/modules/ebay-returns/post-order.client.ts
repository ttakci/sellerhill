// apps/api/src/modules/ebay-returns/post-order.client.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay/ebay-http-retry';

import { RETURN_SEARCH_LIMIT, RETURN_SEARCH_SORT } from './ebay-returns.constants';
import type {
  PostOrderPaginationOutput,
  PostOrderReturnSearchResponse,
  PostOrderReturnSummary,
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

/**
 * eBay Post-Order API — READ ONLY. The one call implemented is
 * `GET /post-order/v2/return/search`
 * (docs/ebay-reference/post-order/post-order_v2_return_search__get.txt).
 *
 * Nothing here writes to eBay: no refund, no decision, no "mark as received".
 * `ebay-returns.guard.spec.ts` fails if a write verb is ever added.
 *
 * Quota: `post-order.return` is 5,000 calls a day for the WHOLE application
 * (production `getRateLimits`, 2026-09-30), so every attempt — a retry
 * included — is charged to `EbayApiResource.POST_ORDER_RETURN` at BACKGROUND
 * priority before it goes out. `EbayBudgetExhaustedError` propagates to the
 * caller, which stops the sweep.
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
          headers: {
            Authorization: `${POST_ORDER_AUTH_PREFIX}${accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          params: {
            creation_date_range_from: params.creationDateFrom,
            limit: RETURN_SEARCH_LIMIT,
            sort: RETURN_SEARCH_SORT,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }),
      { logger: this.logger, acquireBudget: this.chargeReturn() }
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
   * eBay's reference for this call: "This method is not supported in the
   * Sandbox environment." A deployment on sandbox keys (local dev, the test
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

  private chargeReturn(): () => Promise<void> {
    return async () => {
      await this.budget.acquire(EbayApiResource.POST_ORDER_RETURN, EbayCallPriority.BACKGROUND);
    };
  }
}
