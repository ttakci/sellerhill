import { Injectable, Logger } from '@nestjs/common';
import { AutoFulfillEvent, AutoFulfillStatus, OrderCostCaptureStatus, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { AutoFulfillEventLog } from '../orders/auto-fulfill-event-log.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { planCostCaptureLinks, resolveScanSince, type AmazonOrderIdHolder } from './cost-capture-plan';
import { type CandidateEbayOrderRow } from './pick-best-match';

interface AmazonAccountSyncRow {
  id: string;
  user_id: string;
  last_orders_sync_at: Date | null;
}

/**
 * Auto cost-capture job (Task 7). For each Amazon buyer account, scrapes the
 * account's "Your Orders" list page, matches each scraped Amazon order to a
 * pending/provisional eBay order for the same user, and — on a strict
 * `scoreAmazonOrderMatch` confident match — writes the real Amazon costs
 * (purchase/tax/shipping), sets `cost_capture_status = linked`, and calls
 * `OrderSyncService.recomputeProfit` so `net_profit` reflects actual spend.
 *
 * It is also the RECONCILIATION for an automatic purchase whose outcome is
 * unknown (the Place Order click went out, no confirmation came back): the
 * checkout queues a run of this job a few minutes after such a click, and a
 * link found here settles the order as placed.
 *
 * Scan only when there is something to find: the eBay orders still waiting for
 * an Amazon order are loaded FIRST. With none, no browser is opened and the
 * watermark is left alone (`resolveScanSince` copes with a stale one).
 *
 * Failure discipline:
 *  - Scrape transport failure: bubbles out of `runForAccount` so BullMQ
 *    retries the whole job (same as Keepa refresh batch retries).
 *  - Per-Amazon-order failure: logged and skipped — never fails the run.
 *  - `last_orders_sync_at` is only advanced when the run completes (covers
 *    both scrape + per-order writes) so a failed run re-pulls the same
 *    window next tick. It is set to the moment the scan STARTED, not ended:
 *    an order placed while the list was being read is then not skipped by
 *    the next scan, and "scanned after the click" means what it says for the
 *    seller's not-purchased confirmation.
 *
 * Never force-links (`planCostCaptureLinks`): the matcher requires ASIN +
 * quantity + the Amazon ship-to recipient being the eBay buyer + a date that
 * fits, refuses a tie between two eBay orders, and an Amazon order id that an
 * order already holds is never attributed to a second one. A confident miss
 * just leaves the eBay order in pending/provisional for manual linking.
 */
@Injectable()
export class AmazonOrderSyncService {
  private readonly logger = new Logger(AmazonOrderSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly scraping: AmazonScrapingService,
    private readonly orderSync: OrderSyncService,
    private readonly trackingQueue: AmazonTrackingQueueService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly autoFulfillEvents: AutoFulfillEventLog,
  ) {}

  /**
   * Run cost-capture for one Amazon buyer account. Designed to be called by
   * the queue processor (one job per account) so transport failures isolate
   * to a single account and BullMQ exponential backoff handles retries.
   */
  async runForAccount(accountId: string): Promise<void> {
    const accountRows = await this.databaseService.query<AmazonAccountSyncRow>(
      `SELECT id, user_id, last_orders_sync_at FROM amazon_accounts WHERE id = $1`,
      [accountId],
    );
    if (accountRows.length === 0) {
      this.logger.warn(`Account ${accountId} not found — skipping sync.`);
      return;
    }
    const account = accountRows[0];

    // Suspension stops the scrape. It was the one Amazon-side pipeline with no
    // entitlement check at all: this tick runs per ACCOUNT on its own cron,
    // independent of order sync, so a suspended seller's buyer accounts kept
    // being logged into and scraped every tick, indefinitely — Playwright pool
    // time spent on an account that pays for nothing.
    //
    // THE POSITION OF THIS RETURN IS LOAD-BEARING, same rule as order sync: it
    // must precede both the scrape and every `advanceSyncedAt` below. Skipping
    // while advancing `last_orders_sync_at` would permanently drop the Amazon
    // orders placed during the suspension from cost capture, because the next
    // run scrapes only from that timestamp forward. Returning here leaves the
    // watermark untouched, so the first tick after payment re-pulls the whole
    // suspended window with no manual step.
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.log(
        `Amazon cost-capture skipped for account ${accountId}: subscription suspended (watermark preserved)`,
      );
      return;
    }

    // The eBay orders of this user that still wait for an Amazon order — loaded
    // BEFORE the scrape. 60-day look-back covers the full sale→purchase path
    // (rarely more than a few days, but generous to avoid missing slow cases).
    // An order that already names an Amazon order id but has no costs yet (a
    // hand link whose cost summary was unreadable) is a candidate too.
    const candidates = await this.databaseService.query<CandidateEbayOrderRow>(
      `SELECT o.id, o.ebay_order_id, p.asin, o.quantity, o.purchase_price, o.order_date,
              o.buyer_name, o.shipping_address,
              o.auto_fulfill_submitted_at, o.amazon_account_id, o.amazon_order_id
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       LEFT JOIN products p ON p.id = l.product_id
       WHERE o.user_id = $1
         AND o.cost_capture_status IN ($2, $3)
         AND o.order_date >= NOW() - INTERVAL '60 days'`,
      [
        account.user_id,
        OrderCostCaptureStatus.PENDING,
        OrderCostCaptureStatus.PROVISIONAL,
      ],
    );

    // Nothing is waiting: every scan costs a browser session on the shared
    // Playwright pool and reads the buyer account's order history for no
    // result. The watermark is deliberately NOT advanced — it records a scan
    // that happened, and none did.
    if (candidates.length === 0) {
      this.logger.debug(`Account ${accountId}: no eBay order is waiting for an Amazon order — not scanned.`);
      return;
    }

    const startedAt = new Date();
    const since = resolveScanSince({ watermark: account.last_orders_sync_at, candidates, now: startedAt });

    // Discriminated scrape result: rows + suspect flag. `suspect` marks a
    // 0-row scrape that we cannot confidently call "legit empty" (Amazon
    // redirected off the orders page, or page-1 order-card lookup returned
    // zero matches — broken selector / unrendered DOM). A suspect 0-row
    // result MUST NOT advance the watermark — next tick re-pulls the same
    // window so we don't silently drop orders forever.
    let amazonOrders;
    try {
      amazonOrders = await this.scraping.scrapeAccountOrders(account.user_id, accountId, since);
    } catch (err) {
      // Transport failure — surface to caller (BullMQ retries). Do NOT advance
      // last_orders_sync_at — next tick re-pulls the same window.
      this.logger.warn(
        `scrapeAccountOrders failed for ${accountId}: ${(err as Error).message}`,
      );
      throw err;
    }

    if (amazonOrders.rows.length === 0) {
      if (amazonOrders.suspect) {
        // Data-failure analog (mirrors Keepa refresh pipeline discipline): a
        // 0-row scrape on a suspect page is NOT a legit empty — do NOT advance
        // the watermark, let the next scheduler tick retry the same window.
        // We do not throw (avoids a BullMQ retry storm on a persistent Amazon
        // layout change; the scheduler cadence naturally re-tries).
        this.logger.warn(
          `Account ${accountId}: suspect 0-row scrape (page not orders or no cards on page 1) ` +
            `— NOT advancing watermark; next tick will retry since ${since.toISOString()}.`,
        );
        return;
      }
      this.logger.debug(`Account ${accountId}: no orders since ${since.toISOString()}.`);
      await this.advanceSyncedAt(accountId, startedAt);
      return;
    }

    // Which of the scraped Amazon order ids does an order row already hold?
    // (Any user's: an Amazon order id is globally unique.) One Amazon order
    // pays for one eBay order — see `planCostCaptureLinks`.
    const scrapedIds = amazonOrders.rows.map((r) => r.amazonOrderId).filter((id) => !!id);
    const holders =
      scrapedIds.length > 0
        ? await this.databaseService.query<AmazonOrderIdHolder>(
            `SELECT id, amazon_order_id FROM orders WHERE amazon_order_id = ANY($1::text[])`,
            [scrapedIds],
          )
        : [];

    // Matcher strictness is operator-tunable at runtime (admin panel), so read
    // it once per run rather than freezing it at construction.
    const [tolerancePct, windowDays] = await Promise.all([
      this.platformSettings.getNumber(PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT),
      this.platformSettings.getNumber(PlatformSettingKey.AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS),
    ]);
    const { links, suspects } = planCostCaptureLinks({
      amazonOrders: amazonOrders.rows,
      candidates,
      holders,
      tolerancePct,
      windowDays,
      accountId,
    });

    // An Amazon order that LOOKS like the one an unconfirmed automatic purchase
    // produced (same product, dated around the click, this account) but that
    // the strict matcher would not link. It is not linked — that would be a
    // guess — but it is remembered: while it stands, `confirmNotPurchased`
    // refuses, so "the scan linked nothing" can never be read as "Amazon has
    // no order" when the scan did see a likely one. Best-effort per order.
    for (const suspect of suspects) {
      try {
        await this.databaseService.query(
          `UPDATE orders SET auto_fulfill_suspect_amazon_order_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND amazon_order_id IS NULL`,
          [suspect.amazonOrderId, suspect.orderId],
        );
        this.logger.warn(
          `Order ${suspect.ebayOrderId}: Amazon order ${suspect.amazonOrderId} may be its unconfirmed purchase ` +
            `but could not be matched with certainty — left for the seller to link.`,
        );
      } catch (err) {
        this.logger.warn(`could not record the suspect Amazon order for ${suspect.ebayOrderId}: ${(err as Error).message}`);
      }
    }

    let linked = 0;
    for (const link of links) {
      const ao = link.amazon;
      try {
        // An order the automatic checkout clicked for was BOUGHT by that
        // checkout: finding its Amazon order settles the unknown outcome, so
        // the row becomes PLACED (and leaves the "purchase not confirmed"
        // stage). Any other order keeps the auto-fulfill status it had.
        await this.databaseService.query(
          `UPDATE orders SET
             amazon_account_id = $1,
             amazon_order_id = $2,
             purchase_price = $3,
             amazon_tax = $4,
             amazon_shipping = $5,
             amazon_linked_at = CURRENT_TIMESTAMP,
             cost_capture_status = $6,
             auto_fulfill_status = CASE
               WHEN auto_fulfill_submitted_at IS NOT NULL THEN $8::auto_fulfill_status
               ELSE auto_fulfill_status
             END,
             auto_fulfill_blocked_reason = CASE
               WHEN auto_fulfill_submitted_at IS NOT NULL THEN NULL
               ELSE auto_fulfill_blocked_reason
             END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            accountId,
            ao.amazonOrderId,
            ao.purchasePrice,
            ao.tax,
            ao.shipping,
            OrderCostCaptureStatus.LINKED,
            link.orderId,
            AutoFulfillStatus.PLACED,
          ],
        );

        // Recompute net_profit + fees from the freshly-persisted costs. Sets
        // cost_capture_status authoritatively (matches what we just wrote).
        await this.orderSync.recomputeProfit(link.ebayOrderId);

        // Kick off Amazon→eBay status tracking for the newly-linked order.
        // Without this, tracking only started at the next API restart
        // (reconcileSchedulers) — shipped/delivered sync would silently lag.
        // Best-effort: a scheduling miss is repaired by the next restart's
        // reconcile and must not fail the link.
        try {
          await this.trackingQueue.scheduleOrderTracking(link.orderId, accountId);
        } catch (err) {
          this.logger.warn(
            `tracking kickoff failed for order ${link.orderId}: ${(err as Error).message}`,
          );
        }
        if (link.clicked) {
          this.logger.log(
            `Order ${link.ebayOrderId}: the unconfirmed automatic purchase was found on Amazon (${ao.amazonOrderId}) — settled as placed.`,
          );
          await this.autoFulfillEvents.record(link.ebayOrderId, AutoFulfillEvent.RECONCILIATION_LINKED, {
            userId: account.user_id,
            amazonAccountId: accountId,
            detail: { amazonOrderId: ao.amazonOrderId, via: link.via, total: ao.grandTotal },
          });
        }
        linked++;
      } catch (err) {
        // Per-Amazon-order failure isolation — never fail the run.
        this.logger.warn(
          `cost-capture for Amazon order ${ao.amazonOrderId} failed: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Account ${accountId}: linked ${linked}/${amazonOrders.rows.length} Amazon orders ` +
        `(candidates: ${candidates.length}).`,
    );
    await this.advanceSyncedAt(accountId, startedAt);
  }

  /** `scannedFrom` is when the scan STARTED — see the class doc. */
  private async advanceSyncedAt(accountId: string, scannedFrom: Date): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts SET last_orders_sync_at = $2 WHERE id = $1`,
      [accountId, scannedFrom.toISOString()],
    );
  }
}
