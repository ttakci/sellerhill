import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { EbayFeedService } from '../ebay/ebay-feed.service';

/**
 * Periodic listing reconciliation against eBay's own catalogue.
 *
 * Nothing in the platform ever asks eBay "which of these listings still
 * exist?". Orders are pulled, price and stock are pushed, but a listing the
 * seller ended in Seller Hub — or that eBay ended — stays ACTIVE here
 * indefinitely, drawing Keepa refresh tokens for a product with no eBay
 * surface left to update. The push path now catches some of those (see
 * `ended-listing.ts`), but only for listings we happen to be updating.
 *
 * SHIPPED IN CAPTURE-ONLY MODE, AND THAT IS NOT A HEDGE
 * -----------------------------------------------------
 * eBay documents the feed task lifecycle precisely and the report FILE's schema
 * not at all — the reference defers to the Merchant Data XSD. A parser written
 * against guessed column names is the exact failure this codebase has paid for
 * before (the Aquiline v3 integration was built against the wrong API surface
 * entirely and could never have worked). So the first phase downloads the real
 * report from a real store, writes it verbatim, and changes NOTHING. The parser
 * is written against that sample; `ebay.feedSync.captureOnly` then goes off.
 *
 * Until then this service deliberately cannot affect a seller's data.
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

    // The parser and the reconciliation it feeds land once a real report has
    // pinned the schema down. Reaching here before that is a configuration
    // mistake, and saying so is better than silently doing nothing.
    this.logger.error(
      `Feed sync for account ${ebayAccountId} (user ${userId}) ran with captureOnly off, ` +
        'but no report parser exists yet — nothing was reconciled. ' +
        'Re-enable ebay.feedSync.captureOnly until the parser ships.'
    );
  }

  /**
   * Write the report exactly as eBay served it.
   *
   * Verbatim matters: the file may be gzipped, and the whole point of this
   * phase is to learn its true shape, so anything that decodes or reformats it
   * on the way to disk defeats the exercise. The log line carries the size and
   * content type so the schema can be identified without opening the file.
   */
  private async captureRaw(
    ebayAccountId: string,
    taskId: string,
    body: Buffer,
    contentType?: string
  ): Promise<void> {
    const dir = path.join(
      process.env.EBAY_FEED_CAPTURE_DIR || path.join(process.cwd(), 'ebay-feed-captures'),
      ebayAccountId
    );
    await fs.mkdir(dir, { recursive: true });

    const file = path.join(dir, `${Date.now()}-${taskId}.raw`);
    await fs.writeFile(file, body);

    this.logger.log(
      `Captured eBay feed report for account ${ebayAccountId}: ${body.length} bytes, ` +
        `content-type ${contentType ?? 'unknown'}, written to ${file}`
    );
  }
}
