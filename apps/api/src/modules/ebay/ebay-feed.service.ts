import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios from 'axios';

import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { withEbayRateLimitRetry } from './ebay-http-retry';
import { EbayService } from './ebay.service';

/**
 * eBay Feed API — bulk report tasks.
 *
 * WHY THIS EXISTS, AND WHY IT DOES NOT REPLACE TRADING
 * ----------------------------------------------------
 * Pulling a seller's live catalogue through `GetMyeBaySelling` costs one
 * metered Trading call per 200 listings, against a ceiling of 5,000 a day for
 * the WHOLE application. Scanning 500 sellers once a day is ~2,500 calls —
 * half the quota — so periodic reconciliation was never affordable there.
 * `LMS_ACTIVE_INVENTORY_REPORT` is one report per seller regardless of
 * catalogue size, on a 100,000/day ceiling: ~12 calls per seller, ~6% of quota
 * for the same 500 sellers.
 *
 * But it is NOT a drop-in replacement. eBay's own description is that the
 * report "contains price and quantity information for all of the active
 * listings" — no title, no image, no API model. Those are exactly the fields
 * the seller-facing import screen renders, so the interactive first discovery
 * stays on Trading (rich, rare, one seller at a time) and this serves the
 * unattended sweep (existence + price + quantity, all sellers).
 *
 * WHAT IS NOT KNOWN YET
 * ---------------------
 * The report FILE's own schema. eBay's reference documents the task lifecycle
 * but points to the Merchant Data XSD for the payload, so the column names are
 * not established here. This service therefore stops at "downloaded bytes" and
 * deliberately does not parse: the caller captures the first real report and
 * the parser is written against it. Guessing the columns is the failure mode
 * this codebase keeps rediscovering — see the Aquiline v3 notes in CLAUDE.md.
 */

/** eBay's feed type for "every active listing, with price and quantity". */
export const ACTIVE_INVENTORY_FEED_TYPE = 'LMS_ACTIVE_INVENTORY_REPORT';

/**
 * Required, and eBay accepts only this value for an inventory task
 * (`CreateInventoryTaskRequest.schemaVersion`: "This field **must** have a
 * value of `1.0`").
 */
const INVENTORY_TASK_SCHEMA_VERSION = '1.0';

/**
 * Our listings are all fixed-price, and the filter takes ONE format — covering
 * both would mean two tasks per seller against a task ceiling eBay does not
 * publish. Omitting the filter is not obviously safer: the reference does not
 * say what an absent `filterCriteria` returns, and an explicit value is a
 * smaller assumption than an implicit default.
 */
const FIXED_PRICE_FORMAT = 'FIXED_PRICE';

/** Terminal task states, per eBay's `FeedStatusEnum`. */
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'COMPLETED_WITH_ERROR',
  'FAILED',
  'PARTIALLY_PROCESSED',
]);

/** States where `download_result_file` will actually return a file. */
const DOWNLOADABLE_STATUSES = new Set(['COMPLETED', 'COMPLETED_WITH_ERROR']);

export interface EbayFeedTask {
  taskId: string;
  status: string;
  feedType?: string;
  creationDate?: string;
  completionDate?: string;
}

export interface ActiveInventoryReportDownload {
  taskId: string;
  /** The last status eBay reported — `COMPLETED_WITH_ERROR` still carries a file. */
  status: string;
  /** Raw bytes exactly as eBay served them: CSV, XML or JSON, possibly gzipped. */
  body: Buffer;
  contentType?: string;
}

/**
 * Report generation is asynchronous and its duration scales with the seller's
 * catalogue. Backoff rather than a fixed interval: a small store finishes in
 * seconds and should not wait, while a large one should not cost 60 polls.
 * Each entry is the delay BEFORE that poll, in milliseconds.
 */
const POLL_BACKOFF_MS = [2_000, 3_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000];

@Injectable()
export class EbayFeedService {
  private readonly logger = new Logger(EbayFeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ebayService: EbayService,
    private readonly ebayCallBudget: EbayCallBudgetService
  ) {}

  /**
   * Create → poll → download, as one call.
   *
   * Every eBay request here is budget-governed at BACKGROUND priority: this is
   * a sweep, never something a seller is waiting on, so it draws against the
   * reserve and can be deferred without anyone noticing.
   *
   * Returns `null` when the task reached a terminal state with no file to
   * download (`FAILED`, or a poll budget exhausted before completion). That is
   * deliberately not an exception: one seller's report failing must not stop
   * the sweep for the rest, and — critically — "no report" must never be
   * mistaken by the caller for "this seller has no listings".
   */
  async fetchActiveInventoryReport(
    ebayAccountId: string
  ): Promise<ActiveInventoryReportDownload | null> {
    const taskId = await this.createActiveInventoryTask(ebayAccountId);
    this.logger.log(`Feed task ${taskId} created for eBay account ${ebayAccountId}`);

    const task = await this.awaitTerminalTask(ebayAccountId, taskId);
    if (!task) {
      this.logger.warn(`Feed task ${taskId} did not finish within the poll budget`);
      return null;
    }
    if (!DOWNLOADABLE_STATUSES.has(task.status)) {
      this.logger.warn(`Feed task ${taskId} ended as ${task.status} with no downloadable report`);
      return null;
    }

    const download = await this.downloadResultFile(ebayAccountId, taskId);
    return { taskId, status: task.status, body: download.body, contentType: download.contentType };
  }

  /** `POST /sell/feed/v1/inventory_task`. The task id comes back in `location`. */
  async createActiveInventoryTask(ebayAccountId: string): Promise<string> {
    const accessToken = await this.ebayService.getAccountAccessToken(ebayAccountId);
    const response = await withEbayRateLimitRetry(
      () =>
        axios.post<{ taskId?: string }>(
          `${this.baseUrl()}/sell/feed/v1/inventory_task`,
          {
            feedType: ACTIVE_INVENTORY_FEED_TYPE,
            schemaVersion: INVENTORY_TASK_SCHEMA_VERSION,
            filterCriteria: { listingFormat: FIXED_PRICE_FORMAT },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 30_000,
          }
        ),
      { logger: this.logger, acquireBudget: this.chargeFeed() }
    );

    // eBay documents the id as arriving in the `location` header; the body
    // carries it on some responses. Read both rather than depending on which,
    // because an unparsed id means a task we have paid for and cannot poll.
    const fromBody = response.data?.taskId;
    const fromHeader = extractTaskIdFromLocation(
      (response.headers as Record<string, unknown> | undefined)?.location
    );
    const taskId = fromBody || fromHeader;
    if (!taskId) {
      throw new Error('eBay accepted the feed task but returned no task id');
    }
    return taskId;
  }

  /** `GET /sell/feed/v1/inventory_task/{task_id}`. */
  async getInventoryTask(ebayAccountId: string, taskId: string): Promise<EbayFeedTask> {
    const accessToken = await this.ebayService.getAccountAccessToken(ebayAccountId);
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<EbayFeedTask>(
          `${this.baseUrl()}/sell/feed/v1/inventory_task/${encodeURIComponent(taskId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 30_000 }
        ),
      { logger: this.logger, acquireBudget: this.chargeFeed() }
    );
    return { ...response.data, taskId, status: response.data?.status ?? 'UNKNOWN' };
  }

  /**
   * `GET /sell/feed/v1/task/{task_id}/download_result_file`.
   *
   * Note the path is `/task/`, not `/inventory_task/` — the download resource
   * is shared across feed types even though the task was created on the
   * inventory-specific one.
   */
  async downloadResultFile(
    ebayAccountId: string,
    taskId: string
  ): Promise<{ body: Buffer; contentType?: string }> {
    const accessToken = await this.ebayService.getAccountAccessToken(ebayAccountId);
    const response = await withEbayRateLimitRetry(
      () =>
        axios.get<ArrayBuffer>(
          `${this.baseUrl()}/sell/feed/v1/task/${encodeURIComponent(taskId)}/download_result_file`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            // The file may be gzipped and is definitely not JSON. Ask axios for
            // bytes so nothing tries to parse it on the way in.
            responseType: 'arraybuffer',
            timeout: 120_000,
          }
        ),
      { logger: this.logger, acquireBudget: this.chargeFeed() }
    );

    const contentType = (response.headers as Record<string, unknown> | undefined)?.['content-type'];
    return {
      body: Buffer.from(response.data),
      contentType: typeof contentType === 'string' ? contentType : undefined,
    };
  }

  /** Poll until the task is terminal, or the backoff schedule runs out. */
  private async awaitTerminalTask(
    ebayAccountId: string,
    taskId: string
  ): Promise<EbayFeedTask | null> {
    for (const delayMs of POLL_BACKOFF_MS) {
      await sleep(delayMs);
      const task = await this.getInventoryTask(ebayAccountId, taskId);
      if (TERMINAL_STATUSES.has(task.status)) {
        return task;
      }
    }
    return null;
  }

  private baseUrl(): string {
    return this.configService.get<string>('EBAY_REST_API_URL') || 'https://api.ebay.com';
  }

  private chargeFeed(): () => Promise<void> {
    return async () => {
      await this.ebayCallBudget.acquire(EbayApiResource.FEED, EbayCallPriority.BACKGROUND);
    };
  }
}

/** `.../inventory_task/12345` → `12345`. Returns undefined for anything else. */
export function extractTaskIdFromLocation(location: unknown): string | undefined {
  if (typeof location !== 'string' || location.length === 0) {
    return undefined;
  }
  const trimmed = location.split('?')[0].replace(/\/+$/, '');
  const last = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return last.length > 0 ? last : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
