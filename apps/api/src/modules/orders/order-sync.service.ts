/**
 * Order Sync Service
 * Handles periodic syncing of eBay orders to our database.
 * Only syncs orders created after the user connected their eBay account.
 * Orders from listings not in our system are marked as untracked.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  BuyerMessageEventType,
  EbayAccountStatus,
  ListingStatus,
  OrderCostCaptureStatus,
  OrderStatus,
  isOrderAlreadyFulfilled,
  type EbayMarketplaceId,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import {
  meetsCoarseCapGate,
  pickRoundRobinAccount,
  resolveAutoFulfillEligibility,
  selectResumableOrders,
  type ResumableOrderRow,
} from '../amazon/auto-fulfill-helpers';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
import { EbayService } from '../ebay/ebay.service';
import { ProductsService } from '../products/products.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import { AutoFulfillQueueService } from './auto-fulfill-queue.service';
import { EbayFulfillmentService } from './ebay-fulfillment.service';
import { computeNetProfit, deriveCostCaptureStatus, estimateProvisionalNetProfit } from './profit-calculation';
import { StockSyncQueueService } from './stock-sync-queue.service';

/**
 * How many unpaid orders `releaseOrdersAwaitingPayment` re-checks per tick.
 * Each one is a metered eBay call, so this bounds the worst case: a seller
 * with a pile of unpaid orders drains over several 20-minute ticks rather than
 * spending a burst of the shared per-application Fulfillment quota at once.
 */
const AWAITING_PAYMENT_RECHECK_LIMIT = 20;

/**
 * Minimum gap between two eBay re-checks of the SAME unpaid order.
 *
 * This, not the per-tick limit, is what actually bounds the cost. Order sync
 * ticks every 20 minutes, so a per-tick-only bound scales with ticks × sellers
 * (72 × 500 × 20 ≈ 720k calls/day against a 100k Fulfillment ceiling — the
 * sweep alone would exhaust the quota for every seller on the platform). Per
 * order the ceiling is instead 24 calls a day, so the real cost tracks the
 * number of unpaid orders in flight, which is small and self-limiting: eBay
 * cancels them after four days and the window closes after seven.
 */
const AWAITING_PAYMENT_RECHECK_INTERVAL_HOURS = 1;

export interface EbayAccountForSync {
  id: string;
  user_id: string;
  marketplace_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  created_at: Date;
  status: string;
  last_ebay_sync_at: Date | null;
}

@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
    private readonly fulfillmentService: EbayFulfillmentService,
    private readonly productsService: ProductsService,
    private readonly stockSyncQueue: StockSyncQueueService,
    private readonly storeSettingsService: StoreSettingsService,
    private readonly autoFulfillQueue: AutoFulfillQueueService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly buyerMessages: BuyerMessageQueueService
  ) {}

  /**
   * Sync orders for all users with active eBay accounts
   */
  async syncOrdersForAllUsers(): Promise<void> {
    this.logger.log('Starting order sync for all users');

    const accounts = await this.databaseService.query<EbayAccountForSync>(
      `SELECT id, user_id, marketplace_id, access_token, refresh_token,
              access_token_expires_at, created_at, status, last_ebay_sync_at
       FROM ebay_accounts WHERE status = $1`,
      [EbayAccountStatus.ACTIVE]
    );

    if (accounts.length === 0) {
      this.logger.log('No active eBay accounts found for order sync');
      return;
    }

    this.logger.log(`Found ${accounts.length} active eBay accounts to sync`);

    for (const account of accounts) {
      try {
        await this.syncOrdersForAccount(account);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Order sync failed for account ${account.id} (user: ${account.user_id}): ${message}`);
      }
    }

    this.logger.log('Order sync completed for all users');
  }

  /**
   * Sync orders for a specific eBay account
   */
  async syncOrdersForAccount(account: EbayAccountForSync): Promise<number> {
    const userId = account.user_id;
    const ebayAccountId = account.id;
    const marketplaceId = account.marketplace_id as EbayMarketplaceId;

    this.logger.log(`Syncing orders for user ${userId}, account ${ebayAccountId}`);

    // Suspension stops order ingestion. THE POSITION OF THIS RETURN IS
    // LOAD-BEARING: it must precede both the fetch loop and the
    // `last_ebay_sync_at` write below. Advancing the watermark while skipping
    // the fetch would permanently lose every order that arrived during the
    // suspension, because the next run starts from that timestamp and nothing
    // ever looks further back. Leaving it untouched is what lets a reinstated
    // account back-fill the whole suspended period on its next tick.
    if (await this.quotaEnforcement.isSuspended(account.user_id)) {
      this.logger.log(
        `Order sync skipped for user ${account.user_id}: subscription suspended (watermark preserved)`
      );
      return 0;
    }

    // Reaching here means the account is entitled again — the early return above
    // ran for the whole account while it was suspended. Six of the seven
    // suspended capabilities resume on their own; auto-fulfill is the exception
    // (`maybeEnqueueAutoFulfill` fires only on a genuine order insert, and a
    // blocked reason is treated as permanent), so restart it by hand here for
    // any order this user has parked at BLOCKED / subscription_suspended.
    await this.resumeSuspendedAutoFulfill(userId);

    // Get fresh access token
    const accessToken = await this.ebayService.getActiveAccountAccessToken(userId);
    if (!accessToken) {
      this.logger.warn(`No access token for user ${userId}`);
      return 0;
    }

    // An order that arrived unpaid was skipped rather than purchased. Order
    // sync never re-fetches an order (the window filters on creationdate and
    // never overlaps), so without this sweep that skip would be permanent and
    // the seller would silently lose automation on every slow-paying order.
    await this.releaseOrdersAwaitingPayment(userId, accessToken, marketplaceId);

    // Only fetch orders since last sync (or account creation if never synced)
    const syncFromDate = account.last_ebay_sync_at
      ? new Date(account.last_ebay_sync_at).toISOString()
      : account.created_at.toISOString();
    let totalSynced = 0;
    let cursor: string | undefined;

    do {
      const result = await this.fulfillmentService.fetchOrders(accessToken, marketplaceId, {
        fromDateString: syncFromDate,
        limit: 50,
        cursor,
      });

      for (const ebayOrder of result.orders) {
        try {
          // Match order to listing using legacyItemId → listings.ebay_item_id
          const lineItem = ebayOrder.lineItems?.[0];
          let listingId: string | null = null;
          // Decided once, here, from the listing's flag at the moment the order
          // arrives — never re-read later, so an order already being automated
          // cannot lose its tracking when a downgrade lands mid-flight.
          let listingOverPlanLimit = false;

          if (lineItem?.legacyItemId) {
            const match = await this.databaseService.query<{
              id: string;
              product_id: string;
              over_plan_limit: boolean;
            }>(
              `SELECT id, product_id, over_plan_limit FROM listings
               WHERE ebay_item_id = $1 AND user_id = $2 AND status = $3
               LIMIT 1`,
              [lineItem.legacyItemId, userId, ListingStatus.ACTIVE]
            );

            if (match.length > 0) {
              listingId = match[0].id;
              listingOverPlanLimit = match[0].over_plan_limit === true;
            }
          }

          // Get purchase price from product via listing
          let purchasePrice: number | undefined;

          if (listingId) {
            const productData = await this.productsService.getProductPriceAndImageByListingId(listingId);
            if (productData) {
              purchasePrice = productData.purchasePrice;
            }
          }

          const entity = this.fulfillmentService.mapEbayOrderToEntity(
            ebayOrder,
            userId,
            ebayAccountId,
            listingId || undefined,
            purchasePrice
          );

          const { inserted } = await this.upsertOrder(
            entity,
            listingOverPlanLimit,
            lineItem?.legacyItemId ?? null,
          );

          // Recompute net_profit + cost_capture_status only for brand-new
          // inserts. Re-syncs that changed ebay_earnings are already handled
          // inside upsertOrder (conditional recompute on earnings delta), and
          // unchanged re-syncs have no recompute-triggering field: listing_id
          // and purchase_price are excluded from ON CONFLICT DO UPDATE SET, so
          // only earnings can move on an existing row. Gating here avoids one
          // redundant recompute roundtrip per changed-earnings re-sync.
          if (inserted) {
            await this.recomputeProfit(entity.ebayOrderId);
          }

          // Sale-driven stock sync: only for a genuinely NEW order matched to one
          // of our listings. We KNOW this sale happened, so deplete the shared
          // product stock by the sold quantity (best estimate until the next 12h
          // Keepa sync), then trigger per-listing quantity recompute + eBay push.
          if (inserted && listingId && entity.quantity > 0) {
            try {
              const match = await this.databaseService.query<{ product_id: string }>(
                `SELECT product_id FROM listings WHERE id = $1`,
                [listingId]
              );
              const productId = match[0]?.product_id;
              if (productId) {
                await this.productsService.decrementStock(productId, entity.quantity);
                await this.stockSyncQueue.enqueueProductStockSync(productId);
              }
            } catch (error: unknown) {
              // Stock sync is best-effort — never fail the order sync because of it.
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Stock sync for order ${entity.ebayOrderId} skipped: ${msg}`);
            }
          }

          // Real-time sold count: same "genuine new matched order" gate as
          // sale-driven stock sync above. Isolated in its own try/catch so a
          // failure here can never block stock sync or auto-fulfill, and vice
          // versa — each is best-effort independently.
          if (inserted && listingId && entity.quantity > 0) {
            try {
              await this.databaseService.query(`UPDATE listings SET sold_count = sold_count + $1 WHERE id = $2`, [
                entity.quantity,
                listingId,
              ]);
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Sold count increment for order ${entity.ebayOrderId} skipped: ${msg}`);
            }
          }

          // Auto-fulfill (best-effort; never fails order sync). Fires only on a
          // genuine new matched order — same gate as sale-driven stock sync. See
          // `maybeEnqueueAutoFulfill` for the toggle/cap/round-robin resolution.
          if (inserted && listingId && entity.quantity > 0) {
            try {
              await this.maybeEnqueueAutoFulfill(entity, listingOverPlanLimit);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.warn(`Auto-fulfill enqueue skipped for ${entity.ebayOrderId}: ${msg}`);
            }
          }

          // Buyer auto-messaging (best-effort; never fails order sync). The
          // order_received "thank you" fires on a genuine new order (env master
          // switch + per-user store config are re-checked at send time, so a
          // disabled feature is a cheap no-op enqueue) — EXCEPT for an order
          // eBay already reports as shipped or delivered.
          //
          // That exclusion is the same returning-seller case the auto-fulfill
          // gate covers, and it is the same predicate: a settled backlog
          // arriving in one tick would otherwise send every one of those buyers
          // "thanks for your order, we're getting it ready" weeks after their
          // parcel landed. Unlike the purchase gate, an UNPAID order is still
          // messaged — eBay only surfaces orders that cleared checkout, and a
          // thank-you costs nothing if the payment later fails.
          if (inserted && !isOrderAlreadyFulfilled(entity.status)) {
            await this.buyerMessages
              .enqueue({
                ebayOrderId: entity.ebayOrderId,
                userId: entity.userId,
                ebayAccountId: entity.ebayAccountId,
                storeId: null,
                event: BuyerMessageEventType.ORDER_RECEIVED,
              })
              .catch((err: unknown) => {
                this.logger.warn(
                  `Buyer-message order_received enqueue skipped for ${entity.ebayOrderId}: ${
                    err instanceof Error ? err.message : String(err)
                  }`
                );
              });
          }

          totalSynced++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to sync eBay order ${ebayOrder.orderId}: ${msg}`);
        }
      }

      cursor = result.nextCursor;
    } while (cursor);

    // Update last_synced_at for all synced orders
    await this.databaseService.query(
      `UPDATE orders SET last_synced_at = CURRENT_TIMESTAMP
       WHERE ebay_account_id = $1 AND last_synced_at IS NULL`,
      [ebayAccountId]
    );

    // Update last_ebay_sync_at on the account itself
    await this.databaseService.query(
      `UPDATE ebay_accounts SET last_ebay_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ebayAccountId]
    );

    this.logger.log(`Synced ${totalSynced} orders for user ${userId}`);
    return totalSynced;
  }

  /**
   * Link a newly imported eBay listing to the PAST orders of that same eBay
   * item, which were ingested before the listing existed here.
   *
   * Called only from the existing-listing import. Without it those orders are
   * stranded for ever: they show "Unknown product", their profit stays
   * unknown, and eBay refuses a shipment for them because a fulfillment needs
   * the line item a listing carries — so neither the tracking push nor a
   * tracking conversion can run even when the seller links the Amazon order by
   * hand.
   *
   * WHAT THIS DELIBERATELY DOES NOT DO: trigger automatic purchasing. Linking
   * an order is not the same thing as deciding to buy it, and auto-fulfill
   * fires ONLY on a genuine order INSERT (`maybeEnqueueAutoFulfill`), never
   * over existing rows. That separation is what makes adoption safe — the
   * reason orders were never back-matched in the first place was the fear of a
   * listing import sending months-old orders shopping on Amazon.
   *
   * Only rows with NO listing are touched, so an order already matched to a
   * different listing can never be moved. Profit is recomputed for each one
   * through the single writer, which turns 'untracked' into 'provisional'.
   */
  async adoptUntrackedOrdersForListing(input: {
    userId: string;
    ebayAccountId: string;
    ebayItemId: string;
    listingId: string;
    listingOverPlanLimit: boolean;
  }): Promise<number> {
    const rows = await this.databaseService.query<{ ebay_order_id: string }>(
      `UPDATE orders
          SET listing_id = $1,
              listing_over_plan_limit = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
          AND ebay_account_id = $4
          AND ebay_legacy_item_id = $5
          AND listing_id IS NULL
        RETURNING ebay_order_id`,
      [
        input.listingId,
        input.listingOverPlanLimit,
        input.userId,
        input.ebayAccountId,
        input.ebayItemId,
      ]
    );

    for (const row of rows) {
      // Best-effort per order: a profit recompute failure must not undo a
      // link that is already correct.
      try {
        await this.recomputeProfit(row.ebay_order_id);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Profit recompute after adoption failed for ${row.ebay_order_id}: ${msg}`);
      }
    }

    if (rows.length > 0) {
      this.logger.log(
        `Linked ${rows.length} previously untracked order(s) to imported listing ${input.listingId}`
      );
    }
    return rows.length;
  }

  /**
   * Insert or update an order from eBay data.
   * Returns whether the row was a brand-new INSERT (`inserted`) vs. an UPDATE of
   * an existing order — detected via Postgres `xmax` so we never double-process a
   * re-synced order. Used to gate one-time side effects (stock decrement).
   */
  private async upsertOrder(
    entity: ReturnType<EbayFulfillmentService['mapEbayOrderToEntity']>,
    listingOverPlanLimit = false,
    ebayLegacyItemId: string | null = null
  ): Promise<{ id: string; inserted: boolean }> {
    // Capture pre-upsert ebay_earnings so we can detect a re-sync that changed
    // the seller's payout (partial refund, adjusted shipping, etc.). When the
    // value changes we must recompute net_profit — the ON CONFLICT SET clause
    // intentionally excludes profit fields. Brand-new inserts (no existing row)
    // yield prevEbayEarnings = null and are handled by the unconditional
    // recomputeProfit call in the sync loop above.
    const existing = await this.databaseService.query<{ ebay_earnings: string | number | null }>(
      `SELECT ebay_earnings FROM orders WHERE ebay_order_id = $1`,
      [entity.ebayOrderId]
    );
    const prevEbayEarnings = existing.length > 0 ? Number(existing[0].ebay_earnings) : null;

    const result = await this.databaseService.query<{ id: string; inserted: boolean }>(
      `INSERT INTO orders (
        user_id, ebay_account_id, ebay_order_id,
        buyer_username, buyer_name, buyer_email, buyer_phone,
        status, order_fulfillment_status, payment_status,
        listing_id,
        quantity,
        sale_price, sale_shipping, sale_tax, sale_total, ebay_earnings, currency,
        purchase_price, transaction_fee, ad_fee, net_profit,
        shipping_address,
        order_date, last_ebay_event_at,
        cost_capture_status,
        ebay_marketplace_fee, ebay_fee_basis_amount, ebay_collect_remit_tax,
        listing_over_plan_limit, ebay_legacy_item_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25,
        $26,
        $27, $28, $29,
        $30, $31
      )
      ON CONFLICT (ebay_order_id) DO UPDATE SET
        status = EXCLUDED.status,
        order_fulfillment_status = EXCLUDED.order_fulfillment_status,
        payment_status = EXCLUDED.payment_status,
        sale_price = EXCLUDED.sale_price,
        sale_shipping = EXCLUDED.sale_shipping,
        sale_tax = EXCLUDED.sale_tax,
        sale_total = EXCLUDED.sale_total,
        ebay_earnings = EXCLUDED.ebay_earnings,
        currency = EXCLUDED.currency,
        quantity = EXCLUDED.quantity,
        shipping_address = EXCLUDED.shipping_address,
        last_ebay_event_at = EXCLUDED.last_ebay_event_at,
        -- COALESCE, never a bare EXCLUDED: eBay assesses the marketplace fee
        -- when the buyer's payment settles, which can be after we first pulled
        -- the order. A later sync that DOES carry the figure fills it in; one
        -- that doesn't must never blank out a value we already captured.
        ebay_marketplace_fee = COALESCE(EXCLUDED.ebay_marketplace_fee, orders.ebay_marketplace_fee),
        ebay_fee_basis_amount = COALESCE(EXCLUDED.ebay_fee_basis_amount, orders.ebay_fee_basis_amount),
        ebay_collect_remit_tax = COALESCE(EXCLUDED.ebay_collect_remit_tax, orders.ebay_collect_remit_tax),
        -- Which eBay item the order came from never changes, so this only ever
        -- fills a blank (an order ingested before migration 111). It is NOT the
        -- listing link: adopting an order into a listing stays an explicit act.
        ebay_legacy_item_id = COALESCE(orders.ebay_legacy_item_id, EXCLUDED.ebay_legacy_item_id),
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, (xmax = 0) AS inserted`,
      [
        entity.userId,
        entity.ebayAccountId,
        entity.ebayOrderId,
        entity.buyerUsername,
        entity.buyerName,
        entity.buyerEmail,
        entity.buyerPhone,
        entity.status,
        entity.orderFulfillmentStatus,
        entity.paymentStatus,
        entity.listingId,
        entity.quantity,
        entity.salePrice,
        entity.saleShipping,
        entity.saleTax,
        entity.saleTotal,
        entity.ebayEarnings,
        entity.currency,
        entity.purchasePrice,
        entity.transactionFee,
        entity.adFee,
        entity.netProfit,
        entity.shippingAddress ? JSON.stringify(entity.shippingAddress) : null,
        entity.orderDate ? entity.orderDate.toISOString() : null,
        entity.lastEbayEventAt ? entity.lastEbayEventAt.toISOString() : null,
        entity.costCaptureStatus,
        entity.ebayMarketplaceFee,
        entity.ebayFeeBasisAmount,
        entity.ebayCollectRemitTax,
        // INSERT only — deliberately absent from ON CONFLICT DO UPDATE, like
        // listing_id: the decision belongs to the order's first ingest.
        listingOverPlanLimit,
        ebayLegacyItemId,
      ]
    );

    const row = result[0];

    // Re-sync freshness: if an existing order's ebay_earnings changed, the
    // persisted net_profit is now stale. Trigger a recompute. Skipped for
    // brand-new inserts (prevEbayEarnings === null) — the sync loop already
    // recomputes those unconditionally.
    const incomingEarnings = Number(entity.ebayEarnings) || 0;
    if (prevEbayEarnings !== null && Math.abs(prevEbayEarnings - incomingEarnings) > 0.001) {
      await this.recomputeProfit(entity.ebayOrderId);
    }

    return { id: row?.id, inserted: row?.inserted ?? false };
  }

  /**
   * Recompute net_profit + cost_capture_status for an order.
   * - Resolves purchase cost by listing_id, then by ASIN fallback (eBay line item ASIN).
   * - Never fakes unknown costs: unknown -> net_profit NULL.
   * - Always sets cost_capture_status in the same UPDATE.
   * - `opts.scrapeFailed: true` forces FAILED (used by linkAmazonOrder when the
   *   scrape reached the page but the financial DOM was empty). The caller still
   *   owns preserving prior costs; this method only reads what's already on the row.
   * Best-effort: logs and swallows errors so sync never fails.
   */
  async recomputeProfit(ebayOrderId: string, opts: { scrapeFailed?: boolean } = {}): Promise<void> {
    try {
      // Pull the order + product ASIN + settings-group fees in one go.
      const rows = await this.databaseService.query<{
        id: string;
        user_id: string;
        sale_total: string | number;
        ebay_earnings: string | number | null;
        purchase_price: string | number | null;
        amazon_tax: string | number | null;
        amazon_shipping: string | number | null;
        amazon_linked_at: Date | null;
        listing_id: string | null;
        asin: string | null;
        fees: { ebayFeePercent?: number; fixedFeeAmount?: number } | null;
      }>(
        `SELECT o.id, o.user_id, o.sale_total, o.ebay_earnings, o.purchase_price,
                o.amazon_tax, o.amazon_shipping, o.amazon_linked_at,
                o.listing_id, p.asin,
                lsg.fees
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         LEFT JOIN listing_settings_groups lsg ON lsg.id = l.listing_settings_group_id
         WHERE o.ebay_order_id = $1`,
        [ebayOrderId]
      );
      if (rows.length === 0) {
        return;
      }
      const o = rows[0];

      const hasListingMatch = !!o.listing_id;
      const asinResolved = !!o.asin;
      const amazonLinked = !!o.amazon_linked_at;
      // A successful Amazon link genuinely captured costs — even if both tax and
      // shipping legitimately sum to $0 (free shipping, no tax). Threshold is
      // "is there a trusted link at all", not "did the sum exceed zero".
      const amazonCostsCaptured = amazonLinked;

      const status = deriveCostCaptureStatus({
        hasListingMatch,
        asinResolved,
        amazonLinked,
        amazonCostsCaptured,
        scrapeFailed: opts.scrapeFailed === true,
      });

      const purchasePrice = Number(o.purchase_price) || 0;

      // Fallback: resolve purchase price from product if still unknown.
      let resolvedPurchase = purchasePrice;
      if (resolvedPurchase <= 0 && hasListingMatch) {
        const productData = await this.productsService.getProductPriceAndImageByListingId(o.listing_id as string);
        if (productData?.purchasePrice) {
          resolvedPurchase = productData.purchasePrice;
        }
      }

      // Persisted net_profit depends on the cost-capture tier:
      //   LINKED      — real scraped amazon_tax + amazon_shipping via computeNetProfit.
      //   PROVISIONAL — estimated via estimateProvisionalNetProfit using the user's
      //                 global amazonTaxRate store setting (Amazon not yet linked).
      //   other tiers — unchanged fallback (computeNetProfit with whatever's on the row,
      //                 typically 0 for unlinked orders); null when purchase unknown.
      let finalNetProfit: number | null = null;
      if (resolvedPurchase > 0) {
        const ebayEarnings = Number(o.ebay_earnings) || 0;
        if (status === OrderCostCaptureStatus.PROVISIONAL) {
          // Resolve user's global tax rate (best-effort — settings must never
          // break recompute; on failure fall back to 0% which equals gross).
          let amazonTaxRatePct = 0;
          try {
            const settings = await this.storeSettingsService.getResolvedSettings(o.user_id, null);
            amazonTaxRatePct = Number(settings.amazonTaxRate) || 0;
          } catch (settingsErr) {
            this.logger.warn(
              `store settings resolve failed for order ${ebayOrderId} (user ${o.user_id}): ${
                (settingsErr as Error).message
              }`
            );
          }
          finalNetProfit = estimateProvisionalNetProfit({
            ebayEarnings,
            purchasePrice: resolvedPurchase,
            amazonTaxRatePct,
          });
        } else {
          // LINKED (real amazon costs) or PENDING/FAILED/UNTRACKED (unchanged).
          finalNetProfit = computeNetProfit({
            ebayEarnings,
            purchasePrice: resolvedPurchase,
            amazonTax: Number(o.amazon_tax) || 0,
            amazonShipping: Number(o.amazon_shipping) || 0,
          });
        }
      }

      const saleTotal = Number(o.sale_total) || 0;
      const ebayFeePercent = Number(o.fees?.ebayFeePercent) || 0;
      const fixedFeeAmount = Number(o.fees?.fixedFeeAmount) || 0;
      const transactionFee = Math.round(saleTotal * (ebayFeePercent / 100) * 100) / 100;
      const adFee = fixedFeeAmount;

      await this.databaseService.query(
        `UPDATE orders SET
           transaction_fee = $1,
           ad_fee = $2,
           net_profit = $3,
           purchase_price = COALESCE(NULLIF($4, 0), purchase_price),
           cost_capture_status = $5,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          transactionFee,
          adFee,
          finalNetProfit, // null when unknown
          resolvedPurchase,
          status,
          o.id,
        ]
      );
    } catch (err) {
      this.logger.error(`recomputeProfit failed for ${ebayOrderId}: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  /**
   * Producer for the `auto-fulfill` queue (A2). Runs only on a brand-new matched
   * eBay order. Best-effort — caller wraps in try/catch so a failure here never
   * breaks order sync.
   *
   * Resolution order:
   *  1. Master toggle (`store_settings.auto_fulfill_enabled`, resolved per-user
   *     global). Off → status `skipped`, no enqueue.
   *  2. Pool of enabled Amazon accounts (`auto_fulfill_enabled = true` AND a
   *     non-null `auto_fulfill_cap_total`). Empty pool → `skipped`.
   *  3. Round-robin pick (oldest `last_used_at` first) across the pool.
   *  4. Coarse cap gate (Task 2's `meetsCoarseCapGate`) using `sale_total` vs
   *     the picked account's cap. Over cap → `skipped`. The HARD cap is the
   *     Amazon review-step grand-total check (Task 6 checkout service).
   *  5. Stamp `last_used_at` on the picked account so the next order rotates.
   *  6. Enqueue one BullMQ job (deduped per eBay order id).
   *
   * Note: `auto_fulfill_status` defaults to `pending` on order insert
   * (migration 038), so the enqueued path leaves the row at `pending` for the
   * processor (Task 8) to pick up. Only the skip paths write `skipped` here.
   */
  private async maybeEnqueueAutoFulfill(
    entity: ReturnType<EbayFulfillmentService['mapEbayOrderToEntity']>,
    listingOverPlanLimit = false
  ): Promise<void> {
    // FIRST GATE — what eBay says about the order itself. Only a paid,
    // unshipped order may be purchased; see `resolveAutoFulfillEligibility` for
    // why both other directions fail closed. Checked ahead of the plan limit
    // because it is the more fundamental fact: an already-shipped order needed
    // no purchase at any plan size, so reporting "over plan limit" there would
    // point the seller at an upgrade that would have changed nothing.
    const eligibility = resolveAutoFulfillEligibility(entity.status);
    if (!eligibility.eligible) {
      await this.setAutoFulfillStatus(entity.ebayOrderId, AutoFulfillStatus.SKIPPED, eligibility.reason);
      return;
    }

    // Only listings within the plan's listing limit are automated. SKIPPED with
    // a reason, not BLOCKED: this is the plan working as designed, so it must
    // not raise an action-required alarm — the order stays visible and the
    // reason explains why nothing was bought. Checked before the store toggle
    // so the reason shown is the real one even when auto-fulfill is also off.
    if (listingOverPlanLimit) {
      await this.setAutoFulfillStatus(
        entity.ebayOrderId,
        AutoFulfillStatus.SKIPPED,
        AutoFulfillBlockedReason.LISTING_OVER_PLAN_LIMIT
      );
      return;
    }
    await this.resolveAndEnqueueAutoFulfill({
      userId: entity.userId,
      ebayAccountId: entity.ebayAccountId,
      ebayOrderId: entity.ebayOrderId,
      saleTotal: Number(entity.saleTotal) || 0,
    });
  }

  /**
   * The shared toggle -> account-pool -> round-robin -> coarse-cap -> AO-reserve
   * chain, resolved at CALL time. Reached from two places — a genuine order
   * insert (`maybeEnqueueAutoFulfill`) and the suspension-resume sweep
   * (`resumeSuspendedAutoFulfill`) — which must not carry two copies of it.
   *
   * Resolution order:
   *  1. Master toggle (`store_settings.auto_fulfill_enabled`) resolved for the
   *     order's OWN eBay store (Store specific > Global > Default). A user can
   *     flip auto-fulfill off for one store while leaving it on elsewhere;
   *     passing the store id (not null) is what honours that override. Off ->
   *     status `skipped`, no enqueue.
   *  2. Pool of enabled Amazon accounts (`auto_fulfill_enabled = true` AND a
   *     non-null `auto_fulfill_cap_total`). Empty pool -> `skipped`.
   *  3. Round-robin pick (oldest `last_used_at` first) across the pool.
   *  4. Coarse cap gate on `sale_total` vs the picked account's cap. Over cap ->
   *     `skipped`. The HARD cap is the Amazon review-step grand-total check.
   *  5. AO monthly quota reserve (BILLING_ENFORCEMENT_ENABLED). Idempotent on
   *     `ebayOrderId` — a re-enqueue from a later tick collapses onto the
   *     existing reservation. Exhausted -> BLOCKED with the shared reason, no
   *     enqueue; existing tracking/cost-capture is untouched.
   *  6. Stamp `last_used_at` on the picked account, then enqueue one BullMQ job
   *     (deduped per eBay order id).
   */
  private async resolveAndEnqueueAutoFulfill(input: {
    userId: string;
    ebayAccountId: string;
    ebayOrderId: string;
    saleTotal: number;
  }): Promise<void> {
    const settings = await this.storeSettingsService.getResolvedSettings(input.userId, input.ebayAccountId);
    if (!settings.autoFulfillEnabled) {
      await this.setAutoFulfillStatus(input.ebayOrderId, AutoFulfillStatus.SKIPPED);
      return;
    }
    const enabled = await this.databaseService.query<{
      id: string;
      last_used_at: Date | null;
      auto_fulfill_cap_total: string | number | null;
    }>(
      `SELECT id, last_used_at, auto_fulfill_cap_total FROM amazon_accounts
        WHERE user_id = $1 AND auto_fulfill_enabled = TRUE AND auto_fulfill_cap_total IS NOT NULL`,
      [input.userId]
    );
    if (enabled.length === 0) {
      await this.setAutoFulfillStatus(input.ebayOrderId, AutoFulfillStatus.SKIPPED);
      return;
    }
    const pick = pickRoundRobinAccount(enabled.map((a) => ({ id: a.id, lastUsedAt: a.last_used_at })));
    if (!pick) {
      await this.setAutoFulfillStatus(input.ebayOrderId, AutoFulfillStatus.SKIPPED);
      return;
    }
    const cap = Number(enabled.find((a) => a.id === pick.id)!.auto_fulfill_cap_total);
    if (!meetsCoarseCapGate(input.saleTotal, cap)) {
      await this.setAutoFulfillStatus(input.ebayOrderId, AutoFulfillStatus.SKIPPED);
      return;
    }
    const quota = await this.quotaEnforcement.reserveAmazonOrder(input.userId, input.ebayOrderId);
    if (!quota.allowed) {
      await this.setAutoFulfillBlocked(
        input.ebayOrderId,
        quota.blockedReason ?? AutoFulfillBlockedReason.QUOTA_EXHAUSTED
      );
      return;
    }
    // Stamp last_used_at so the next order rotates to the next account.
    await this.databaseService.query(`UPDATE amazon_accounts SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      pick.id,
    ]);
    await this.autoFulfillQueue.enqueue(input.ebayOrderId, pick.id);
  }

  /**
   * Re-enqueue every order this user has sitting at
   * `auto_fulfill_status = 'blocked'` / `auto_fulfill_blocked_reason =
   * 'subscription_suspended'`. Called once per `syncOrdersForAccount` run, which
   * only reaches this point when the account is entitled — so arriving here IS
   * the "entitlement restored" signal, and no webhook, queue or service is
   * needed to drive it.
   *
   * Scoped strictly to `subscription_suspended` (`selectResumableOrders` is the
   * single predicate): every other blocked reason describes a condition payment
   * does not change, and `cap` is a spend guard.
   *
   * Best-effort — the whole method is wrapped so a failure can never break order
   * sync. Idempotent — the PENDING reset moves a row out of the SELECT, so a
   * user with several eBay stores (one `syncOrdersForAccount` call each per
   * tick) does the work on the first pass and finds nothing on the rest.
   */
  private async resumeSuspendedAutoFulfill(userId: string): Promise<void> {
    try {
      // DUPLICATE-PURCHASE GUARD. This sweep is the ONLY mechanism in the
      // codebase that moves a `blocked` order back to `pending`
      // (`maybeEnqueueAutoFulfill` fires only on a genuine order INSERT, and a
      // blocked row is never re-inserted), so it is the only place that can
      // re-arm an order for a real Amazon purchase. If a seller bought the item
      // by hand during the lapse to save the eBay sale, re-enqueueing here ships
      // a duplicate. Two independent exclusions, catching different cases:
      //   - `amazon_order_id IS NULL` — anything non-null means someone already
      //     bought/linked it (a blocked order never reached a purchase);
      //     catches a hand purchase still sitting at `processing`.
      //   - `status NOT IN (shipped, completed)` — the buyer has been served;
      //     catches a hand purchase not yet linked to an Amazon order id.
      // `selectResumableOrders` re-applies both in code so the rule stays
      // unit-testable.
      const rows = await this.databaseService.query<
        ResumableOrderRow & { ebay_account_id: string; sale_total: string | number | null }
      >(
        `SELECT ebay_order_id, ebay_account_id, sale_total, status, amazon_order_id,
                auto_fulfill_status, auto_fulfill_blocked_reason
           FROM orders
          WHERE user_id = $1
            AND auto_fulfill_status = $2
            AND auto_fulfill_blocked_reason = $3
            AND amazon_order_id IS NULL
            AND status NOT IN ($4, $5)`,
        [
          userId,
          AutoFulfillStatus.BLOCKED,
          AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
          OrderStatus.SHIPPED,
          OrderStatus.COMPLETED,
        ]
      );
      const resumableIds = new Set(selectResumableOrders(rows).map((r) => r.ebay_order_id));
      if (resumableIds.size === 0) {
        return;
      }

      let requeued = 0;
      for (const row of rows) {
        if (!resumableIds.has(row.ebay_order_id)) {
          continue;
        }
        // Reset to PENDING and clear the reason BEFORE re-resolving: the
        // processor's `shouldSkipFulfillStart` refuses a BLOCKED row, so an
        // order left blocked would enqueue and then silently no-op. The shared
        // resolution re-checks the store toggle, the account pool, the
        // round-robin pick, the coarse cap and the AO quota, and writes
        // SKIPPED / BLOCKED itself if any of them still refuse.
        try {
          await this.databaseService.query(
            `UPDATE orders
                SET auto_fulfill_status = $1,
                    auto_fulfill_blocked_reason = NULL,
                    updated_at = CURRENT_TIMESTAMP
              WHERE ebay_order_id = $2`,
            [AutoFulfillStatus.PENDING, row.ebay_order_id]
          );
          await this.resolveAndEnqueueAutoFulfill({
            userId,
            ebayAccountId: row.ebay_account_id,
            ebayOrderId: row.ebay_order_id,
            saleTotal: Number(row.sale_total) || 0,
          });
          requeued += 1;
        } catch (rowErr) {
          // Restore the blocked state so the row is not stranded at PENDING with
          // no job — the next tick will pick it up again.
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          this.logger.warn(`Auto-fulfill resume failed for order ${row.ebay_order_id}: ${rowMsg}`);
          await this.setAutoFulfillBlocked(
            row.ebay_order_id,
            AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED
          ).catch(() => undefined);
        }
      }

      if (requeued > 0) {
        this.logger.log(
          `Auto-fulfill resume: re-evaluated ${requeued} suspension-blocked order(s) for user ${userId}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Auto-fulfill resume sweep skipped for user ${userId}: ${msg}`);
    }
  }

  /**
   * Re-check orders that were skipped as unpaid, and release the ones that
   * have since been paid for.
   *
   * This is the other half of the ORDER_NOT_PAID gate. Refusing to buy an
   * unpaid order is only safe if the refusal can be undone — and order sync
   * cannot undo it on its own, because it filters on `creationdate` with
   * non-overlapping windows, so an order is fetched exactly once and its later
   * payment is never observed. Each candidate therefore costs one metered
   * `getOrder` call, which is why the candidate set is bounded hard:
   *
   *  - `order_date` within 7 days. eBay cancels an unpaid order after four, so
   *    anything older will never be paid and asking again buys nothing.
   *  - `amazon_order_id IS NULL` — the same duplicate-purchase guard the
   *    suspension sweep uses. A non-null id means somebody already bought it.
   *  - LIMIT, so a backlog costs a bounded number of calls per tick and drains
   *    over several ticks instead of in one burst.
   *
   * In the normal case the SELECT returns nothing and no eBay call is made.
   * Fail-soft throughout: this is a recovery path, and a failure here must
   * never stop the order sync it runs in front of.
   */
  private async releaseOrdersAwaitingPayment(
    userId: string,
    accessToken: string,
    marketplaceId: EbayMarketplaceId
  ): Promise<void> {
    try {
      const rows = await this.databaseService.query<{
        ebay_order_id: string;
        ebay_account_id: string;
        sale_total: string | number | null;
      }>(
        `SELECT ebay_order_id, ebay_account_id, sale_total
           FROM orders
          WHERE user_id = $1
            AND auto_fulfill_status = $2
            AND auto_fulfill_blocked_reason = $3
            AND amazon_order_id IS NULL
            AND order_date > NOW() - INTERVAL '7 days'
            AND (
              auto_fulfill_attempted_at IS NULL
              OR auto_fulfill_attempted_at < NOW() - ($4 || ' hours')::INTERVAL
            )
          ORDER BY order_date DESC
          LIMIT $5`,
        [
          userId,
          AutoFulfillStatus.SKIPPED,
          AutoFulfillBlockedReason.ORDER_NOT_PAID,
          String(AWAITING_PAYMENT_RECHECK_INTERVAL_HOURS),
          AWAITING_PAYMENT_RECHECK_LIMIT,
        ]
      );
      if (rows.length === 0) {
        return;
      }

      let released = 0;
      for (const row of rows) {
        try {
          // Stamp BEFORE the call, not after. The stamp is what enforces the
          // one-call-per-hour bound, so it has to cost an attempt even when the
          // attempt then fails — otherwise a row that always throws is retried
          // on every tick and the bound is only honoured on the happy path.
          await this.databaseService.query(
            `UPDATE orders SET auto_fulfill_attempted_at = NOW() WHERE ebay_order_id = $1`,
            [row.ebay_order_id]
          );

          const fresh = await this.fulfillmentService.fetchOrderById(
            accessToken,
            marketplaceId,
            row.ebay_order_id
          );
          // 404 — the order is gone from eBay (cancelled for non-payment is the
          // usual reason). Leave the row as it is; it ages out of the window.
          if (!fresh) {
            continue;
          }

          const status = this.fulfillmentService.mapEbayOrderToEntity(
            fresh,
            userId,
            row.ebay_account_id
          ).status;

          // Still unpaid — nothing to do, ask again next tick.
          if (status === OrderStatus.PENDING) {
            continue;
          }

          // The eBay-side state moved, so persist it before deciding: the
          // eligibility rule reads the mapped status, and it must decide on
          // what the row now says rather than on what it said at ingest.
          await this.databaseService.query(
            `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE ebay_order_id = $2`,
            [status, row.ebay_order_id]
          );

          const eligibility = resolveAutoFulfillEligibility(status);
          if (!eligibility.eligible) {
            // Paid but already fulfilled while we waited — somebody shipped it
            // by hand. Re-label it so the reason matches what actually happened.
            await this.setAutoFulfillStatus(
              row.ebay_order_id,
              AutoFulfillStatus.SKIPPED,
              eligibility.reason
            );
            continue;
          }

          // Clear the skip BEFORE re-resolving, for the same reason the
          // suspension sweep does: `shouldSkipFulfillStart` refuses a SKIPPED
          // row, so an order left skipped would enqueue and then no-op.
          await this.setAutoFulfillStatus(row.ebay_order_id, AutoFulfillStatus.PENDING);
          await this.resolveAndEnqueueAutoFulfill({
            userId,
            ebayAccountId: row.ebay_account_id,
            ebayOrderId: row.ebay_order_id,
            saleTotal: Number(row.sale_total) || 0,
          });
          released += 1;
        } catch (rowErr) {
          // Restore the skip so the row is not stranded at PENDING with no job.
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          this.logger.warn(
            `Awaiting-payment recheck failed for order ${row.ebay_order_id}: ${rowMsg}`
          );
          await this.setAutoFulfillStatus(
            row.ebay_order_id,
            AutoFulfillStatus.SKIPPED,
            AutoFulfillBlockedReason.ORDER_NOT_PAID
          ).catch(() => undefined);
        }
      }

      if (released > 0) {
        this.logger.log(
          `Awaiting-payment recheck: released ${released} now-paid order(s) for user ${userId}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Awaiting-payment recheck skipped for user ${userId}: ${msg}`);
    }
  }

  /**
   * The reason is written with the status, and omitting it CLEARS any stored
   * one — a reason describes the status it arrived with, so leaving a stale
   * `subscription_suspended` on a row the resume sweep has just moved to
   * SKIPPED would explain the wrong thing.
   */
  private async setAutoFulfillStatus(
    ebayOrderId: string,
    status: AutoFulfillStatus,
    reason: AutoFulfillBlockedReason | null = null
  ): Promise<void> {
    await this.databaseService.query(
      `UPDATE orders
          SET auto_fulfill_status = $1,
              auto_fulfill_blocked_reason = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE ebay_order_id = $3`,
      [status, reason, ebayOrderId]
    );
  }

  /**
   * Mark an order BLOCKED with an explicit fail-closed reason (shared enum —
   * never a hardcoded string). Used by the AO quota gate to surface quota
   * exhaustion in the "needs attention" filter. Mirrors the writer shape used
   * by AmazonCheckoutService.block.
   */
  private async setAutoFulfillBlocked(ebayOrderId: string, reason: AutoFulfillBlockedReason): Promise<void> {
    await this.databaseService.query(
      `UPDATE orders
         SET auto_fulfill_status = $1,
             auto_fulfill_blocked_reason = $2,
             auto_fulfill_attempted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE ebay_order_id = $3`,
      [AutoFulfillStatus.BLOCKED, reason, ebayOrderId]
    );
  }
}
