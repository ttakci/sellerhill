import { Injectable, Logger } from '@nestjs/common';
import { OrderCostCaptureStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { OrderSyncService } from '../orders/order-sync.service';

import { AmazonScrapingService, type AmazonListOrderRow } from './amazon-scraping.service';
import { scoreAmazonOrderMatch } from './order-matcher';

interface AmazonAccountSyncRow {
  id: string;
  user_id: string;
  last_orders_sync_at: Date | null;
}

interface CandidateEbayOrderRow {
  id: string;
  ebay_order_id: string;
  asin: string | null;
  quantity: number;
  sale_total: string | number;
  order_date: Date;
}

interface MatchPick {
  orderId: string;
  ebayOrderId: string;
  score: number;
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

    let amazonOrders: AmazonListOrderRow[];
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

    if (amazonOrders.length === 0) {
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
        `Account ${accountId}: ${amazonOrders.length} Amazon orders but no pending eBay candidates.`,
      );
      await this.advanceSyncedAt(accountId);
      return;
    }

    let linked = 0;
    for (const ao of amazonOrders) {
      try {
        const best = this.pickBestMatch(ao, candidates);
        if (!best) {continue;} // strict matcher — never force-link

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
      `Account ${accountId}: linked ${linked}/${amazonOrders.length} Amazon orders ` +
        `(candidates: ${candidates.length}).`,
    );
    await this.advanceSyncedAt(accountId);
  }

  /**
   * Pick the highest-scoring eBay candidate for an Amazon order. Returns null
   * when no candidate passes the strict matcher — caller MUST treat that as a
   * no-op (never force-link).
   */
  private pickBestMatch(
    ao: AmazonListOrderRow,
    candidates: CandidateEbayOrderRow[],
  ): MatchPick | null {
    let best: MatchPick | null = null;
    for (const c of candidates) {
      const result = scoreAmazonOrderMatch({
        amazon: {
          asin: ao.asin,
          quantity: ao.quantity,
          grandTotal: ao.grandTotal,
          orderDate: ao.orderDate.toISOString(),
        },
        ebay: {
          asin: c.asin ?? undefined,
          quantity: c.quantity,
          saleTotal: Number(c.sale_total),
          orderDate: c.order_date.toISOString(),
        },
        tolerancePct: this.tolerancePct,
        windowDays: this.windowDays,
      });
      if (result.match && (!best || result.score > best.score)) {
        best = { orderId: c.id, ebayOrderId: c.ebay_order_id, score: result.score };
      }
    }
    return best;
  }

  private async advanceSyncedAt(accountId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts SET last_orders_sync_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [accountId],
    );
  }
}
