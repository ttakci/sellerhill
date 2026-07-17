import { Injectable, Logger } from '@nestjs/common';
import { OrderCostCaptureStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonScrapingService } from './amazon-scraping.service';
import {
  pickBestMatch,
  type CandidateEbayOrderRow,
} from './pick-best-match';

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
 * Failure discipline:
 *  - Scrape transport failure: bubbles out of `runForAccount` so BullMQ
 *    retries the whole job (same as Keepa refresh batch retries).
 *  - Per-Amazon-order failure: logged and skipped — never fails the run.
 *  - `last_orders_sync_at` is only advanced when the run completes (covers
 *    both scrape + per-order writes) so a failed run re-pulls the same
 *    window next tick.
 *
 * Never force-links: the matcher requires ASIN + quantity + amount-within-
 * tolerance + date-within-window. A confident miss just leaves the eBay order
 * in pending/provisional for manual linking.
 */
@Injectable()
export class AmazonOrderSyncService {
  private readonly logger = new Logger(AmazonOrderSyncService.name);
  private readonly tolerancePct = Number(process.env.AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT) || 5;
  private readonly windowDays = Number(process.env.AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS) || 7;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly scraping: AmazonScrapingService,
    private readonly orderSync: OrderSyncService,
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

    // Default window: 30 days back on first sync (covers typical eBay→Amazon
    // purchase lag) — subsequent runs use the previous successful timestamp.
    const since = account.last_orders_sync_at ?? new Date(Date.now() - 30 * 86_400_000);

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
        // layout change; the 30-min scheduler cadence naturally re-tries).
        this.logger.warn(
          `Account ${accountId}: suspect 0-row scrape (page not orders or no cards on page 1) ` +
            `— NOT advancing watermark; next tick will retry since ${since.toISOString()}.`,
        );
        return;
      }
      this.logger.debug(`Account ${accountId}: no orders since ${since.toISOString()}.`);
      await this.advanceSyncedAt(accountId);
      return;
    }

    // Load candidate eBay orders for this user that still need cost capture.
    // 60-day look-back window covers the full Amazon→eBay sale→purchase path
    // (rarely more than a few days, but generous to avoid missing slow cases).
    const candidates = await this.databaseService.query<CandidateEbayOrderRow>(
      `SELECT o.id, o.ebay_order_id, p.asin, o.quantity, o.sale_total, o.order_date
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

    if (candidates.length === 0) {
      this.logger.debug(
        `Account ${accountId}: ${amazonOrders.rows.length} Amazon orders but no pending eBay candidates.`,
      );
      await this.advanceSyncedAt(accountId);
      return;
    }

    // Track eBay candidate order IDs already consumed by a prior Amazon order
    // in this run, so two Amazon rows can't both write to the same eBay order.
    // (The strict matcher could otherwise pick the same eBay row twice when
    // two Amazon orders have identical ASIN/qty/amount/date signatures.)
    const consumedEbayOrderIds = new Set<string>();
    let linked = 0;
    for (const ao of amazonOrders.rows) {
      try {
        const best = pickBestMatch({
          amazon: ao,
          candidates,
          tolerancePct: this.tolerancePct,
          windowDays: this.windowDays,
        });
        if (!best) {continue;} // strict matcher — never force-link
        if (consumedEbayOrderIds.has(best.ebayOrderId)) {
          // Already linked to an earlier Amazon order this run — skip rather
          // than overwrite the prior write.
          this.logger.warn(
            `Account ${accountId}: eBay order ${best.ebayOrderId} already consumed ` +
              `this run — skipping Amazon order ${ao.amazonOrderId}.`,
          );
          continue;
        }

        await this.databaseService.query(
          `UPDATE orders SET
             amazon_account_id = $1,
             amazon_order_id = $2,
             purchase_price = $3,
             amazon_tax = $4,
             amazon_shipping = $5,
             amazon_linked_at = CURRENT_TIMESTAMP,
             cost_capture_status = $6,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $7`,
          [
            accountId,
            ao.amazonOrderId,
            ao.purchasePrice,
            ao.tax,
            ao.shipping,
            OrderCostCaptureStatus.LINKED,
            best.orderId,
          ],
        );

        // Mark this eBay candidate as consumed BEFORE recompute so any later
        // Amazon row in this loop can't pick the same one.
        consumedEbayOrderIds.add(best.ebayOrderId);

        // Recompute net_profit + fees from the freshly-persisted costs. Sets
        // cost_capture_status authoritatively (matches what we just wrote).
        await this.orderSync.recomputeProfit(best.ebayOrderId);
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
    await this.advanceSyncedAt(accountId);
  }

  private async advanceSyncedAt(accountId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts SET last_orders_sync_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [accountId],
    );
  }
}
