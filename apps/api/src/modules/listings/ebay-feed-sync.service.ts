import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';

import { Injectable, Logger } from '@nestjs/common';
import { ListingStatus, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { EbayFeedService } from '../ebay/ebay-feed.service';

import { decodeReportBody, parseActiveInventoryReportXml } from './feed-report-parser';

/**
 * Periodic listing reconciliation against eBay's own catalogue.
 *
 * Nothing in the platform ever asked eBay "which of these listings still
 * exist?". Orders are pulled, price and stock are pushed, but a listing the
 * seller ended in Seller Hub — or that eBay ended — stayed ACTIVE here
 * indefinitely, drawing Keepa refresh tokens for a product with no eBay
 * surface left to update. The push path catches some of those (see
 * `ended-listing.ts`), but only for listings we happen to be updating.
 *
 * THE PARSER IS WRITTEN AGAINST A REAL CAPTURED REPORT, NOT A GUESS
 * -------------------------------------------------------------------
 * eBay documents the feed task lifecycle precisely and the report FILE's schema
 * not at all — the reference defers to the Merchant Data XSD. Rather than ship
 * a parser against guessed column names (the exact failure that made the
 * Aquiline v3 integration unworkable), `ebay.feedSync.captureOnly` shipped
 * first: download the real report from a real store, write it verbatim, change
 * nothing. A real report was captured 2026-09-22; `feed-report-parser.ts` is
 * written against that sample. See its header comment for the confirmed shape.
 *
 * WHAT RECONCILIATION ACTUALLY DOES (once captureOnly is off)
 * -------------------------------------------------------------------
 * Only ONE direction: a TRACKED listing (`listings.ebay_item_id` set, status
 * ACTIVE) that is ABSENT from a report eBay reported COMPLETE is retired to
 * INACTIVE. Nothing is ever created or reactivated from this report — a
 * listing appearing here that we have no row for is not adopted (that is the
 * import flow's job, with its own explicit ASIN mapping), and a listing
 * present in both report and our table is left untouched.
 *
 * A report that could not be parsed, or a `COMPLETED_WITH_ERROR` status, or a
 * `COMPLETED` report with zero readable items, never retires anything —
 * "eBay's answer is unusable" is not evidence of an empty catalogue, and
 * confusing the two would end every listing that store owns.
 */
@Injectable()
export class EbayFeedSyncService {
  private readonly logger = new Logger(EbayFeedSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly feed: EbayFeedService,
    private readonly platformSettings: PlatformSettingsService
  ) {}

  /**
   * One tick: claim the most-overdue stores and reconcile them in sequence.
   *
   * Sequential on purpose. eBay meters feed TASKS separately from API calls
   * (160024 concurrent, 160025 per hour/day) and publishes no figure for
   * either, so until those are observed the sweep stays slow by construction
   * rather than by a limit we would be guessing at.
   */
  async runSweep(): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_FEED_SYNC_ENABLED))) {
      return;
    }

    const accounts = await this.claimDueAccounts();
    if (accounts.length === 0) {
      return;
    }

    for (const account of accounts) {
      try {
        await this.reconcileAccount(account.id, account.user_id);
      } catch (err) {
        // One store's report failing must never stop the others. The watermark
        // was already advanced by the claim, so a broken store is retried on
        // its next interval rather than blocking the queue behind it.
        this.logger.warn(
          `Feed sync failed for eBay account ${account.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  /**
   * Take the stores that are due, stamping the watermark in the SAME statement.
   *
   * `FOR UPDATE SKIP LOCKED` + stamp-on-claim, the same shape as the Keepa
   * refresh claim: two API replicas ticking at once can never both take the
   * same store, and a crashed run costs one interval rather than looping.
   */
  private async claimDueAccounts(): Promise<Array<{ id: string; user_id: string }>> {
    const intervalHours = await this.platformSettings.getNumber(
      PlatformSettingKey.EBAY_FEED_SYNC_INTERVAL_HOURS
    );
    const maxAccounts = await this.platformSettings.getNumber(
      PlatformSettingKey.EBAY_FEED_SYNC_MAX_ACCOUNTS_PER_RUN
    );

    return this.database.query<{ id: string; user_id: string }>(
      `WITH due AS (
         SELECT id
           FROM ebay_accounts
          WHERE status = 'active'
            AND (
              last_feed_sync_at IS NULL
              OR last_feed_sync_at < NOW() - ($1 || ' hours')::INTERVAL
            )
          ORDER BY last_feed_sync_at ASC NULLS FIRST, id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE ebay_accounts AS a
          SET last_feed_sync_at = NOW()
         FROM due
        WHERE a.id = due.id
        RETURNING a.id, a.user_id`,
      [String(intervalHours), maxAccounts]
    );
  }

  private async reconcileAccount(ebayAccountId: string, userId: string): Promise<void> {
    const report = await this.feed.fetchActiveInventoryReport(ebayAccountId);
    if (!report) {
      // No file. Explicitly NOT "this seller has no listings" — treating a
      // failed report as an empty catalogue would retire everything they own.
      return;
    }

    const captureOnly = await this.platformSettings.getBoolean(
      PlatformSettingKey.EBAY_FEED_SYNC_CAPTURE_ONLY
    );
    if (captureOnly) {
      await this.captureRaw(ebayAccountId, report.taskId, report.body, report.contentType);
      return;
    }

    // COMPLETED_WITH_ERROR means eBay itself flagged some records as
    // unreliable. We cannot tell WHICH ones, so the whole report is untrusted
    // for retirement — acting on it risks ending a listing that is, in fact,
    // one of the erroring records rather than a genuinely absent one.
    if (report.status !== 'COMPLETED') {
      this.logger.warn(
        `Feed report for account ${ebayAccountId} ended as ${report.status}; skipping reconciliation`
      );
      return;
    }

    const items = parseActiveInventoryReportXml(decodeReportBody(report.body));
    if (items.length === 0) {
      // A COMPLETED report with nothing readable in it is more likely a parser
      // problem (or a genuinely empty store) than something to act on. Either
      // way, retiring every tracked listing on an unreadable "confirmation" of
      // emptiness is the expensive direction to be wrong in — log and stop.
      this.logger.warn(
        `Feed report for account ${ebayAccountId} parsed to zero items; skipping reconciliation ` +
          '(this is expected for a store with no live listings, but also what a parser mismatch looks like)'
      );
      return;
    }

    const seenItemIds = new Set(items.map((item) => item.ebayItemId));
    await this.retireAbsentListings(ebayAccountId, userId, seenItemIds);
  }

  /**
   * Retire our TRACKED, ACTIVE listings that the report does not mention.
   *
   * Scoped to `ebay_account_id = $1 AND status = 'active' AND ebay_item_id IS
   * NOT NULL` — a draft (no `ebay_item_id` yet) is never touched, and only
   * this store's own listings are considered, never another store's.
   */
  private async retireAbsentListings(
    ebayAccountId: string,
    userId: string,
    seenItemIds: ReadonlySet<string>
  ): Promise<void> {
    const tracked = await this.database.query<{ id: string; ebay_item_id: string }>(
      `SELECT id, ebay_item_id FROM listings
        WHERE ebay_account_id = $1 AND status = $2 AND ebay_item_id IS NOT NULL`,
      [ebayAccountId, ListingStatus.ACTIVE]
    );

    const absentIds = tracked.filter((row) => !seenItemIds.has(row.ebay_item_id)).map((row) => row.id);
    if (absentIds.length === 0) {
      return;
    }

    const result = await this.database.query<{ id: string }>(
      `UPDATE listings
          SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::uuid[]) AND status = $3
        RETURNING id`,
      [ListingStatus.INACTIVE, absentIds, ListingStatus.ACTIVE]
    );

    if (result.length > 0) {
      this.logger.log(
        `Feed reconciliation: marked ${result.length} listing(s) inactive for account ${ebayAccountId} ` +
          `(user ${userId}) — absent from eBay's active inventory report`
      );
    }
  }

  /**
   * Write the report exactly as eBay served it, and log enough of it to READ.
   *
   * Two outputs, because each alone is useless here:
   *
   *  - The FILE is verbatim. It may be gzipped, and the point of this phase is
   *    to learn the report's true shape, so anything that decodes or reformats
   *    it on the way to disk defeats the exercise. It defaults under `logs/`
   *    because that path is a mounted volume in both Coolify compose files —
   *    written anywhere else it would sit inside the container and vanish on
   *    the next deploy, which is exactly when someone would go looking for it.
   *    Promtail globs `*.log`, so a `.raw` file is correctly not shipped.
   *
   *  - The LOG PREVIEW is what actually gets read. Reaching a file inside a
   *    running container needs shell access; a log line reaches Grafana and
   *    `docker logs` on its own. So the preview is decompressed first (a
   *    gzipped report logged raw is unreadable bytes) and truncated — the
   *    header row and a few records are all that is needed to write the
   *    parser, and the whole report could be megabytes.
   */
  private async captureRaw(
    ebayAccountId: string,
    taskId: string,
    body: Buffer,
    contentType?: string
  ): Promise<void> {
    const dir = path.join(
      process.env.EBAY_FEED_CAPTURE_DIR || path.join(process.cwd(), 'logs', 'ebay-feed-captures'),
      ebayAccountId
    );
    await fs.mkdir(dir, { recursive: true });

    const file = path.join(dir, `${Date.now()}-${taskId}.raw`);
    await fs.writeFile(file, body);

    this.logger.log(
      `Captured eBay feed report for account ${ebayAccountId}: ${body.length} bytes, ` +
        `content-type ${contentType ?? 'unknown'}, written to ${file}`
    );
    this.logger.log(
      `eBay feed report preview (account ${ebayAccountId}):\n${previewReport(body)}`
    );
  }
}

/** How much of the report to put in the log. Enough for the header + a few rows. */
const PREVIEW_CHARS = 2_000;

/** gzip's magic number. eBay serves the report compressed or not, per its docs. */
function isGzip(body: Buffer): boolean {
  return body.length > 2 && body[0] === 0x1f && body[1] === 0x8b;
}

/**
 * A readable opening slice of the report, whatever eBay wrapped it in.
 *
 * Decompression is best-effort on purpose: if the bytes turn out not to be
 * gzip after all, a preview of the raw bytes still tells us more than an
 * exception would, and the verbatim file on disk is the real artefact either
 * way. This must never be able to fail the capture it is describing.
 */
export function previewReport(body: Buffer): string {
  let text: Buffer = body;
  if (isGzip(body)) {
    try {
      text = zlib.gunzipSync(body);
    } catch {
      return `[gzip header present but the body would not decompress; ${body.length} raw bytes on disk]`;
    }
  }

  const slice = text.subarray(0, PREVIEW_CHARS).toString('utf8');
  return text.length > PREVIEW_CHARS
    ? `${slice}\n… [truncated; ${text.length} bytes total]`
    : slice;
}
