// apps/api/src/modules/ebay-returns/ebay-returns-sync.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { RETURN_SEARCH_WINDOW_DAYS } from './ebay-returns.constants';
import { PostOrderClient } from './post-order.client';
import { EbayReturnRow, mapReturnSummary } from './return-mapper';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ClaimedAccount {
  id: string;
  user_id: string;
  marketplace_id: string | null;
}

/**
 * What goes into a log line for a failed store. Never the response body (it
 * can carry a buyer's name and comment) and never the request (it carries the
 * seller's token) — only the HTTP status, or the error's own message.
 */
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
 * Periodic read of each store's return requests from eBay's Post-Order API.
 *
 * READ ONLY, and ONE direction: eBay → `ebay_returns`. Nothing is ever sent to
 * eBay (no refund, no decision), and nothing is ever deleted or blanked here
 * because a fetch failed — a store that could not be read keeps the rows it
 * already has until a later sweep reads it again.
 *
 * Same shape as the listing reconciliation sweep (`EbayFeedSyncService`): a
 * tick claims the most-overdue stores and reads them one after another. One
 * call per store per sweep, against `post-order.return`'s 5,000 calls a day
 * for the whole application — `ebay.returnSync.intervalHours` is the knob that
 * spends that quota.
 */
@Injectable()
export class EbayReturnsSyncService {
  private readonly logger = new Logger(EbayReturnsSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly postOrder: PostOrderClient
  ) {}

  /** One tick: claim the stores that are due and read them in sequence. */
  async sweep(): Promise<void> {
    // Re-read on every tick, so switching the feature off in the admin panel
    // stops the calls without a restart.
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_RETURN_SYNC_ENABLED))) {
      return;
    }

    // Production only: eBay documents the return search as not supported in
    // Sandbox. Checked BEFORE the claim, so a sandbox deployment stamps no
    // watermark and logs no per-store failure.
    if (!this.postOrder.isReturnSearchSupported()) {
      this.logger.debug('Return sync skipped: eBay return search is not supported in the Sandbox environment');
      return;
    }

    const accounts = await this.claimDueAccounts();
    for (const account of accounts) {
      try {
        await this.syncAccount(account);
      } catch (err) {
        if (err instanceof EbayBudgetExhaustedError) {
          // The shared daily quota is spent, so no further store can be read
          // this tick. The stores already claimed keep their new watermark:
          // they are read again one interval from now rather than on the next
          // tick. Losing one interval is accepted — un-stamping them would
          // make every tick until the quota resets re-claim the same stores
          // and fail the same way.
          this.logger.warn(`Return sync stopped at eBay account ${account.id}: ${err.message}`);
          return;
        }
        // One store failing must never stop the others. Its watermark was
        // advanced by the claim, so it is retried on its next interval, and
        // the rows it already has are left exactly as they are.
        this.logger.warn(`Return sync failed for eBay account ${account.id}: ${describeFailure(err)}`);
      }
    }
  }

  /**
   * Take the stores that are due, stamping the watermark in the SAME statement
   * (`FOR UPDATE SKIP LOCKED` + stamp-on-claim, as the feed-sync and refresh
   * claims do): two API replicas ticking at once can never both take the same
   * store, and a crashed run costs one interval rather than looping.
   */
  private async claimDueAccounts(): Promise<ClaimedAccount[]> {
    const intervalHours = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_HOURS);
    const maxAccounts = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN);

    return this.database.query<ClaimedAccount>(
      `WITH due AS (
         SELECT id
           FROM ebay_accounts
          WHERE status = 'active'
            AND (
              last_return_sync_at IS NULL
              OR last_return_sync_at < NOW() - ($1 || ' hours')::INTERVAL
            )
          ORDER BY last_return_sync_at ASC NULLS FIRST, id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE ebay_accounts AS a
          SET last_return_sync_at = NOW()
         FROM due
        WHERE a.id = due.id
        RETURNING a.id, a.user_id, a.marketplace_id`,
      [String(intervalHours), maxAccounts]
    );
  }

  private async syncAccount(account: ClaimedAccount): Promise<void> {
    // Suspension stops the read, like every other per-store sweep. Nothing is
    // lost by skipping: each sweep re-reads the whole search window rather
    // than continuing from a watermark, so the first sweep after the account
    // is entitled again sees everything a skipped one would have.
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.debug(`Return sync skipped for eBay account ${account.id}: subscription suspended`);
      return;
    }

    if (!account.marketplace_id) {
      // `X-EBAY-C-MARKETPLACE-ID` is a required header; never guess a site.
      this.logger.warn(`Return sync skipped for eBay account ${account.id}: no marketplace id on the account`);
      return;
    }

    const accessToken = await this.ebay.getAccountAccessToken(account.id);
    if (!accessToken) {
      this.logger.warn(`Return sync skipped for eBay account ${account.id}: no access token`);
      return;
    }

    const creationDateFrom = new Date(Date.now() - RETURN_SEARCH_WINDOW_DAYS * MS_PER_DAY).toISOString();
    const result = await this.postOrder.searchReturns(accessToken, account.marketplace_id, { creationDateFrom });

    const members = result.members ?? [];
    const totalEntries = result.paginationOutput?.totalEntries;
    if (typeof totalEntries === 'number' && totalEntries > members.length) {
      // The documented limitation of `PostOrderClient.searchReturns`: only the
      // first page is read, so the oldest returns of this window are missing.
      this.logger.warn(
        `Return sync for eBay account ${account.id} read ${members.length} of ${totalEntries} returns ` +
          '(first page only; older returns in the window were not read)'
      );
    }

    let stored = 0;
    let unmapped = 0;
    let failed = 0;
    let firstFailure: string | null = null;

    for (const member of members) {
      const row = mapReturnSummary(member);
      if (!row) {
        unmapped += 1;
        continue;
      }
      try {
        await this.upsertReturn(account, row);
        stored += 1;
      } catch (err) {
        // One row the database refuses (for example a value longer than its
        // column) must not cost the store its other returns.
        failed += 1;
        firstFailure ??= err instanceof Error ? err.message : String(err);
      }
    }

    if (unmapped > 0 || failed > 0) {
      // A database error message names a type or a constraint, never a value.
      const detail = firstFailure === null ? '' : ' (first error: ' + firstFailure + ')';
      this.logger.warn(
        `Return sync for eBay account ${account.id}: ${stored} stored, ${unmapped} without a return id, ` +
          `${failed} not written${detail}`
      );
    } else {
      this.logger.debug(`Return sync for eBay account ${account.id}: ${stored} stored`);
    }
  }

  /**
   * Insert or refresh one return.
   *
   * Every mapped column is overwritten with what eBay reports NOW, including
   * back to NULL: `sellerResponseDue` "might not be returned if there is
   * currently no action due from the seller", and keeping the previous value
   * would show an action as due for ever. `first_seen_at` is never touched.
   *
   * `order_id` links the return to the SellerHill order with that eBay order
   * id, for the same seller only. It is NULL when we hold no such order, and
   * an existing link is never dropped by a later sweep (COALESCE).
   */
  private async upsertReturn(account: ClaimedAccount, row: EbayReturnRow): Promise<void> {
    await this.database.query(
      `INSERT INTO ebay_returns (
         user_id, ebay_account_id, return_id, ebay_order_id, order_id,
         ebay_item_id, ebay_transaction_id, return_quantity,
         state, status, current_type, reason, reason_type,
         buyer_comment, buyer_login_name,
         seller_activity_due, seller_respond_by,
         estimated_refund_amount, actual_refund_amount, currency,
         escalation_case_id, created_on_ebay_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::text, $4::text,
         (SELECT o.id FROM orders o WHERE o.ebay_order_id = $4::text AND o.user_id = $1::uuid LIMIT 1),
         $5::text, $6::text, $7::int,
         $8::text, $9::text, $10::text, $11::text, $12::text,
         $13::text, $14::text,
         $15::text, $16::timestamptz,
         $17::numeric, $18::numeric, $19::text,
         $20::text, $21::timestamptz
       )
       ON CONFLICT (ebay_account_id, return_id) DO UPDATE SET
         ebay_order_id = EXCLUDED.ebay_order_id,
         order_id = COALESCE(ebay_returns.order_id, EXCLUDED.order_id),
         ebay_item_id = EXCLUDED.ebay_item_id,
         ebay_transaction_id = EXCLUDED.ebay_transaction_id,
         return_quantity = EXCLUDED.return_quantity,
         state = EXCLUDED.state,
         status = EXCLUDED.status,
         current_type = EXCLUDED.current_type,
         reason = EXCLUDED.reason,
         reason_type = EXCLUDED.reason_type,
         buyer_comment = EXCLUDED.buyer_comment,
         buyer_login_name = EXCLUDED.buyer_login_name,
         seller_activity_due = EXCLUDED.seller_activity_due,
         seller_respond_by = EXCLUDED.seller_respond_by,
         estimated_refund_amount = EXCLUDED.estimated_refund_amount,
         actual_refund_amount = EXCLUDED.actual_refund_amount,
         currency = EXCLUDED.currency,
         escalation_case_id = EXCLUDED.escalation_case_id,
         created_on_ebay_at = EXCLUDED.created_on_ebay_at,
         last_synced_at = NOW(),
         updated_at = NOW()`,
      [
        account.user_id,
        account.id,
        row.returnId,
        row.ebayOrderId,
        row.ebayItemId,
        row.ebayTransactionId,
        row.returnQuantity,
        row.state,
        row.status,
        row.currentType,
        row.reason,
        row.reasonType,
        row.buyerComment,
        row.buyerLoginName,
        row.sellerActivityDue,
        row.sellerRespondBy,
        row.estimatedRefundAmount,
        row.actualRefundAmount,
        row.currency,
        row.escalationCaseId,
        row.createdOnEbayAt,
      ]
    );
  }
}
