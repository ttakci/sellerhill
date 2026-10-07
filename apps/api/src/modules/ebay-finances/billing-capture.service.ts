// apps/api/src/modules/ebay-finances/billing-capture.service.ts

import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { EBAY_FINANCES_SCOPE, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { SWEEP_DUE_SLACK_SQL } from '../../common/utils/sweep-claim-sql';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { buildBillingDateFilter, readBillingPage, summarizeFeeTypes } from './billing-capture.helpers';
import { BILLING_KEEP_SWEEPS, BILLING_MAX_PAGES, BILLING_PAGE_LIMIT } from './ebay-finances.constants';
import type { BillingPage, ClaimedBillingAccount } from './ebay-finances.types';
import { FinancesClient } from './finances.client';

function describeFailure(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const status = (err as { response?: { status?: unknown } }).response?.status;
    if (typeof status === 'number') {
      return `eBay answered HTTP ${status}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Billing activity capture (spec Part C3, CAPTURE-ONLY).
 *
 * The real ad fee eBay charged is only in the Finances API's billing activity,
 * and the `feeType` value that marks a Promoted Listings fee is not in any
 * document we could obtain (its enum page answers 403). So, as with the Feed
 * report, nothing is parsed before a real response exists: every 4 hours each
 * store that granted `sell.finances` has its recent billing activity written
 * to disk VERBATIM, one file per page, with one log line naming the `feeType`
 * values seen. The database receives nothing but the claim stamp
 * (`ebay-finances.guard.spec.ts`). The parser and the `orders` columns come
 * with C3, written against these files.
 *
 * A store without the scope is never claimed (its token would get a 403 on a
 * pool shared by every seller).
 */
@Injectable()
export class BillingCaptureService {
  private readonly logger = new Logger(BillingCaptureService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly finances: FinancesClient
  ) {}

  /** One tick: claim the stores that are due and capture them in sequence. */
  async runSweep(): Promise<void> {
    // Re-read every tick, so switching it off in the panel stops the calls at once.
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_BILLING_SYNC_ENABLED))) {
      return;
    }

    const accounts = await this.claimDueAccounts();
    for (const account of accounts) {
      try {
        await this.captureAccount(account);
      } catch (err) {
        if (err instanceof EbayBudgetExhaustedError) {
          // The shared daily pool is spent: no further store can be read this
          // tick. The claimed stores keep their stamp and are read one
          // interval from now (same trade-off as the return sweep).
          this.logger.warn(`Billing capture stopped at eBay account ${account.id}: ${err.message}`);
          return;
        }
        // One store failing never stops the others; its stamp was advanced by
        // the claim, so it is retried on its next interval. Pages already
        // written stay on disk as partial evidence.
        this.logger.warn(`Billing capture failed for eBay account ${account.id}: ${describeFailure(err)}`);
      }
    }
  }

  /**
   * The stores that are due, stamped in the SAME statement (`FOR UPDATE SKIP
   * LOCKED` + stamp-on-claim, like the feed and return sweeps): two replicas
   * never take the same store, and a crashed run costs one interval. Only
   * active stores whose recorded consent included `sell.finances`.
   */
  private async claimDueAccounts(): Promise<ClaimedBillingAccount[]> {
    const intervalHours = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BILLING_SYNC_INTERVAL_HOURS);
    const maxAccounts = await this.platformSettings.getNumber(
      PlatformSettingKey.EBAY_BILLING_SYNC_MAX_ACCOUNTS_PER_RUN
    );

    return this.database.query<ClaimedBillingAccount>(
      `WITH due AS (
         SELECT id
           FROM ebay_accounts
          WHERE status = 'active'
            AND granted_scopes @> ARRAY[$3]::text[]
            AND (
              last_billing_sync_at IS NULL
              OR last_billing_sync_at < NOW() - ($1 || ' hours')::INTERVAL + ${SWEEP_DUE_SLACK_SQL}
            )
          ORDER BY last_billing_sync_at ASC NULLS FIRST, id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE ebay_accounts AS a
          SET last_billing_sync_at = NOW()
         FROM due
        WHERE a.id = due.id
        RETURNING a.id, a.user_id`,
      [String(intervalHours), maxAccounts, EBAY_FINANCES_SCOPE]
    );
  }

  private async captureAccount(account: ClaimedBillingAccount): Promise<void> {
    // Suspension stops the read, like every other per-store sweep.
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.debug(`Billing capture skipped for eBay account ${account.id}: subscription suspended`);
      return;
    }

    const accessToken = await this.ebay.getAccountAccessToken(account.id);
    if (!accessToken) {
      this.logger.warn(`Billing capture skipped for eBay account ${account.id}: no access token`);
      return;
    }

    const windowDays = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BILLING_SYNC_WINDOW_DAYS);
    const filter = buildBillingDateFilter(new Date(), windowDays);
    // One key for every file of this sweep, so a parser can tell a complete
    // capture (it has a `-done.json`) from one that failed part-way.
    const sweepTs = Date.now();
    try {
      await this.readPages(account.id, accessToken, filter, sweepTs);
    } finally {
      await this.pruneOldSweeps(account.id);
    }
  }

  private async readPages(accountId: string, accessToken: string, filter: string, sweepTs: number): Promise<void> {
    const pages: BillingPage[] = [];
    let reachedCap = true;
    let documented = true;

    for (let page = 0; page < BILLING_MAX_PAGES; page += 1) {
      const body = await this.finances.getBillingActivities(accessToken, {
        filter,
        offset: page * BILLING_PAGE_LIMIT,
      });
      // Written before it is judged: an unexpected body is exactly the evidence wanted.
      await this.writeCapture(accountId, `${sweepTs}-p${page}.json`, body);

      const facts = readBillingPage(body);
      if (!facts) {
        this.logger.warn(
          `Billing capture for eBay account ${accountId}: page ${page} is not the documented object; stopped`
        );
        reachedCap = false;
        documented = false;
        break;
      }
      pages.push(facts);

      const lastPage =
        facts.count < BILLING_PAGE_LIMIT ||
        !facts.hasNext ||
        (facts.total !== null && (page + 1) * BILLING_PAGE_LIMIT >= facts.total);
      if (lastPage) {
        reachedCap = false;
        break;
      }
    }

    if (reachedCap) {
      this.logger.warn(
        `Billing capture for eBay account ${accountId} stopped at ${BILLING_MAX_PAGES} pages; older activity is unread`
      );
    }

    const lines = pages.reduce((sum, page) => sum + page.count, 0);
    const total = pages.find((page) => page.total !== null)?.total ?? null;
    const feeTypes = summarizeFeeTypes(pages);
    if (documented) {
      // Written last: its presence is what says the pages above are the whole read.
      await this.writeCapture(accountId, `${sweepTs}-done.json`, { pages: pages.length, lines, total, reachedCap, feeTypes });
    }
    this.logger.log(
      `Billing capture for eBay account ${accountId}: ${pages.length} page(s), ${lines} line(s)` +
        `${total === null ? '' : ` of ${total}`}, fee types: ${feeTypes}`
    );
  }

  /** Keep the newest BILLING_KEEP_SWEEPS sweeps of one store; never throws (housekeeping only). */
  private async pruneOldSweeps(accountId: string): Promise<void> {
    const dir = this.captureDir(accountId);
    try {
      const files = await fs.readdir(dir);
      const sweeps = [...new Set(files.map((file) => file.split('-')[0]).filter((key) => /^\d+$/.test(key)))].sort(
        (a, b) => Number(b) - Number(a)
      );
      const stale = new Set(sweeps.slice(BILLING_KEEP_SWEEPS));
      for (const file of files) {
        if (stale.has(file.split('-')[0])) {
          await fs.rm(path.join(dir, file), { force: true });
        }
      }
    } catch (err) {
      this.logger.warn(
        `Billing capture could not prune old files for eBay account ${accountId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private captureDir(accountId: string): string {
    return path.join(
      process.env.EBAY_FINANCES_CAPTURE_DIR || path.join(process.cwd(), 'logs', 'ebay-finances-captures'),
      accountId
    );
  }

  /** Verbatim JSON. The directory is on the api_logs volume in both Coolify stacks. */
  private async writeCapture(accountId: string, name: string, body: unknown): Promise<void> {
    const dir = this.captureDir(accountId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), JSON.stringify(body ?? null));
  }
}
