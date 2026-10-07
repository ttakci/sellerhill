// apps/api/src/modules/ebay-returns/ebay-cancellations-sync.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EBAY_CANCEL_REQUESTOR_BUYER, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { EbayCancellationRow, mapCancellation } from './cancellation-mapper';
import { ClaimedAccount, describeFailure } from './ebay-returns-sync.service';
import { CANCELLATION_SEARCH_WINDOW_DAYS } from './ebay-returns.constants';
import { PostOrderClient } from './post-order.client';
import { ReturnSweepScheduleService } from './return-sweep-schedule.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Periodic read of each store's BUYER cancellation requests
 * (`GET /post-order/v2/cancellation/search?role=BUYER`) into
 * `ebay_cancellations`. A copy of the return sweep (`EbayReturnsSyncService`):
 * read only, eBay → table, nothing deleted or blanked on a failed read, the
 * claim stamps `last_cancellation_sync_at` in the same statement.
 *
 * Quota: one call per store per sweep against `post-order.cancellation`'s
 * 5,000 calls a day for the whole application — its own pool. The interval is
 * derived from the store count and that limit
 * (`ReturnSweepScheduleService.resolveCancellations()`), with the return
 * sweep's settings: at 500 stores and the 50% share that is every 6 h, about
 * 2,000 calls a day, leaving ~3,000 for the sellers' own reads and answers.
 *
 * Express lane: order sync already sees eBay's `cancelStatus.cancelState`
 * move off `NONE_REQUESTED` (migration 128). A store with such an order
 * changed since its last cancellation read is due NOW, so a fresh request
 * reaches the order page within one tick instead of one interval.
 */
@Injectable()
export class EbayCancellationsSyncService {
  private readonly logger = new Logger(EbayCancellationsSyncService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly ebay: EbayService,
    private readonly postOrder: PostOrderClient,
    private readonly schedule: ReturnSweepScheduleService
  ) {}

  /** One tick: claim the stores that are due and read them in sequence. */
  async sweep(): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_CANCELLATION_SYNC_ENABLED))) {
      return;
    }
    // "This method is not supported in the Sandbox environment." Checked
    // before the claim, so a sandbox deployment stamps nothing.
    if (!this.postOrder.isReturnSearchSupported()) {
      this.logger.debug('Cancellation sync skipped: eBay cancellation search is not supported in the Sandbox environment');
      return;
    }

    const accounts = await this.claimDueAccounts();
    for (const account of accounts) {
      try {
        await this.syncAccount(account);
      } catch (err) {
        if (err instanceof EbayBudgetExhaustedError) {
          // Same rule as the return sweep: claimed stores keep their stamp.
          this.logger.warn(`Cancellation sync stopped at eBay account ${account.id}: ${err.message}`);
          return;
        }
        this.logger.warn(`Cancellation sync failed for eBay account ${account.id}: ${describeFailure(err)}`);
      }
    }
  }

  /** Claim-and-stamp in ONE statement (`FOR UPDATE SKIP LOCKED`), plus the express lane. */
  private async claimDueAccounts(): Promise<ClaimedAccount[]> {
    const { intervalHours } = await this.schedule.resolveCancellations();
    const maxAccounts = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_RETURN_SYNC_MAX_ACCOUNTS_PER_RUN);

    return this.database.query<ClaimedAccount>(
      `WITH due AS (
         SELECT id
           FROM ebay_accounts
          WHERE status = 'active'
            AND (
              last_cancellation_sync_at IS NULL
              OR last_cancellation_sync_at < NOW() - ($1 || ' hours')::INTERVAL
              OR (
                -- Express lane: order sync saw a cancel state that is neither
                -- "none" nor "cancelled" on an order no stored request is linked
                -- to yet. Bounded to one extra sweep an hour per store: many
                -- writers bump orders.updated_at, and a state that lingers
                -- (a rejected request, an id that never links) must not turn
                -- every tick into a Post-Order call.
                last_cancellation_sync_at < NOW() - INTERVAL '1 hour'
                AND EXISTS (
                  SELECT 1 FROM orders o
                   WHERE o.ebay_account_id = ebay_accounts.id
                     AND o.ebay_cancel_state NOT IN ('NONE_REQUESTED', 'CANCELED')
                     AND o.updated_at > ebay_accounts.last_cancellation_sync_at
                     AND NOT EXISTS (SELECT 1 FROM ebay_cancellations c WHERE c.order_id = o.id)
                )
              )
            )
          ORDER BY last_cancellation_sync_at ASC NULLS FIRST, id ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       UPDATE ebay_accounts AS a
          SET last_cancellation_sync_at = NOW()
         FROM due
        WHERE a.id = due.id
        RETURNING a.id, a.user_id, a.marketplace_id`,
      [String(intervalHours), maxAccounts]
    );
  }

  private async syncAccount(account: ClaimedAccount): Promise<void> {
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.debug(`Cancellation sync skipped for eBay account ${account.id}: subscription suspended`);
      return;
    }
    if (!account.marketplace_id) {
      this.logger.warn(`Cancellation sync skipped for eBay account ${account.id}: no marketplace id on the account`);
      return;
    }
    const accessToken = await this.ebay.getAccountAccessToken(account.id);
    if (!accessToken) {
      this.logger.warn(`Cancellation sync skipped for eBay account ${account.id}: no access token`);
      return;
    }

    const creationDateFrom = new Date(Date.now() - CANCELLATION_SEARCH_WINDOW_DAYS * MS_PER_DAY).toISOString();
    const result = await this.postOrder.searchCancellations(accessToken, account.marketplace_id, { creationDateFrom });

    const entries = result.cancellations ?? [];
    const totalEntries = result.paginationOutput?.totalEntries;
    if (typeof totalEntries === 'number' && totalEntries > entries.length) {
      this.logger.warn(
        `Cancellation sync for eBay account ${account.id} read ${entries.length} of ${totalEntries} requests ` +
          '(first page only; older requests in the window were not read)'
      );
    }

    let stored = 0;
    let unmapped = 0;
    let failed = 0;
    let firstFailure: string | null = null;
    for (const entry of entries) {
      const row = mapCancellation(entry);
      if (!row) {
        unmapped += 1;
        continue;
      }
      try {
        const linked = await this.upsertCancellation(account, row);
        stored += 1;
        if (!linked && row.requestorType === EBAY_CANCEL_REQUESTOR_BUYER && row.closedAt === null) {
          // The order-id equality is unverified: an open BUYER request that
          // matched no order is invisible on the orders page, so say so.
          this.logger.warn(
            `Cancellation ${row.cancelId} on eBay account ${account.id} (legacy order ${row.legacyOrderId ?? '?'}) ` +
              'is linked to no order; it is counted but not listed'
          );
        }
      } catch (err) {
        failed += 1;
        firstFailure ??= err instanceof Error ? err.message : String(err);
      }
    }

    if (unmapped > 0 || failed > 0) {
      const detail = firstFailure === null ? '' : ' (first error: ' + firstFailure + ')';
      this.logger.warn(
        `Cancellation sync for eBay account ${account.id}: ${stored} stored, ${unmapped} without a cancel id, ` +
          `${failed} not written${detail}`
      );
    } else {
      this.logger.debug(`Cancellation sync for eBay account ${account.id}: ${stored} stored`);
    }
  }

  /**
   * Insert or refresh one request — every mapped column overwritten with what
   * eBay reports now, including back to NULL (`sellerResponseDueDate` "is not
   * returned if the order cancellation request does not currently require a
   * response from the seller"). `first_seen_at` is never touched; an erased
   * row (`buyer_data_erased_at`) keeps its buyer login NULL; the order link is
   * resolved for the same seller AND store and never dropped (COALESCE).
   * Also called by `EbayCancellationsActionsService` after an answer.
   */
  /** Resolves to whether the row is linked to one of our orders. */
  async upsertCancellation(account: Pick<ClaimedAccount, 'id' | 'user_id'>, row: EbayCancellationRow): Promise<boolean> {
    const rows = await this.database.query<{ order_id: string | null }>(
      `INSERT INTO ebay_cancellations (
         user_id, ebay_account_id, cancel_id, legacy_order_id, order_id,
         marketplace_id, requestor_type, state, status, reason, close_reason,
         buyer_login_name, requested_at, seller_respond_by, buyer_respond_by, closed_at,
         requested_refund_amount, currency, payment_status
       ) VALUES (
         $1::uuid, $2::uuid, $3::text, $4::text,
         (SELECT o.id FROM orders o
           WHERE o.ebay_order_id = $4::text AND o.user_id = $1::uuid AND o.ebay_account_id = $2::uuid
           LIMIT 1),
         $5::text, $6::text, $7::text, $8::text, $9::text, $10::text,
         $11::text, $12::timestamptz, $13::timestamptz, $14::timestamptz, $15::timestamptz,
         $16::numeric, $17::text, $18::text
       )
       ON CONFLICT (ebay_account_id, cancel_id) DO UPDATE SET
         legacy_order_id = EXCLUDED.legacy_order_id,
         order_id = COALESCE(ebay_cancellations.order_id, EXCLUDED.order_id),
         marketplace_id = EXCLUDED.marketplace_id,
         requestor_type = EXCLUDED.requestor_type,
         state = EXCLUDED.state,
         status = EXCLUDED.status,
         reason = EXCLUDED.reason,
         close_reason = EXCLUDED.close_reason,
         buyer_login_name = CASE
           WHEN ebay_cancellations.buyer_data_erased_at IS NOT NULL THEN NULL
           ELSE EXCLUDED.buyer_login_name
         END,
         requested_at = EXCLUDED.requested_at,
         seller_respond_by = EXCLUDED.seller_respond_by,
         buyer_respond_by = EXCLUDED.buyer_respond_by,
         closed_at = EXCLUDED.closed_at,
         requested_refund_amount = EXCLUDED.requested_refund_amount,
         currency = EXCLUDED.currency,
         payment_status = EXCLUDED.payment_status,
         last_synced_at = NOW(),
         updated_at = NOW()
       RETURNING order_id`,
      [
        account.user_id,
        account.id,
        row.cancelId,
        row.legacyOrderId,
        row.marketplaceId,
        row.requestorType,
        row.state,
        row.status,
        row.reason,
        row.closeReason,
        row.buyerLoginName,
        row.requestedAt,
        row.sellerRespondBy,
        row.buyerRespondBy,
        row.closedAt,
        row.requestedRefundAmount,
        row.currency,
        row.paymentStatus,
      ]
    );
    return typeof rows[0]?.order_id === 'string';
  }
}
