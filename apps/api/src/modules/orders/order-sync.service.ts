/**
 * Order Sync Service
 * Handles periodic syncing of eBay orders to our database.
 * Only syncs orders created after the user connected their eBay account.
 * Orders from listings not in our system are marked as untracked.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EbayAccountStatus, type EbayMarketplaceId } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';
import { ProductsService } from '../products/products.service';

import { EbayFulfillmentService } from './ebay-fulfillment.service';
import { StockSyncQueueService } from './stock-sync-queue.service';

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
    private readonly stockSyncQueue: StockSyncQueueService
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

    // Get fresh access token
    const accessToken = await this.ebayService.getActiveAccountAccessToken(userId);
    if (!accessToken) {
      this.logger.warn(`No access token for user ${userId}`);
      return 0;
    }

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

          if (lineItem?.legacyItemId) {
            const match = await this.databaseService.query<{ id: string; product_id: string }>(
              `SELECT id, product_id FROM listings
               WHERE ebay_item_id = $1 AND user_id = $2
               LIMIT 1`,
              [lineItem.legacyItemId, userId]
            );

            if (match.length > 0) {
              listingId = match[0].id;
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

          const { inserted } = await this.upsertOrder(entity);

          // Calculate profit for tracked orders
          if (listingId) {
            await this.recalculateProfit(entity.ebayOrderId);
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
   * Insert or update an order from eBay data.
   * Returns whether the row was a brand-new INSERT (`inserted`) vs. an UPDATE of
   * an existing order — detected via Postgres `xmax` so we never double-process a
   * re-synced order. Used to gate one-time side effects (stock decrement).
   */
  private async upsertOrder(
    entity: ReturnType<EbayFulfillmentService['mapEbayOrderToEntity']>
  ): Promise<{ id: string; inserted: boolean }> {
    const result = await this.databaseService.query<{ id: string; inserted: boolean }>(
      `INSERT INTO orders (
        user_id, ebay_account_id, ebay_order_id,
        buyer_username, buyer_name, buyer_email, buyer_phone,
        status, order_fulfillment_status, payment_status,
        listing_id,
        quantity,
        sale_price, sale_shipping, sale_tax, sale_total, ebay_earnings,
        purchase_price, transaction_fee, ad_fee, net_profit,
        shipping_address,
        order_date, last_ebay_event_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24
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
        quantity = EXCLUDED.quantity,
        shipping_address = EXCLUDED.shipping_address,
        last_ebay_event_at = EXCLUDED.last_ebay_event_at,
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
        entity.purchasePrice,
        entity.transactionFee,
        entity.adFee,
        entity.netProfit,
        entity.shippingAddress ? JSON.stringify(entity.shippingAddress) : null,
        entity.orderDate ? entity.orderDate.toISOString() : null,
        entity.lastEbayEventAt ? entity.lastEbayEventAt.toISOString() : null,
      ]
    );

    const row = result[0];
    return { id: row?.id, inserted: row?.inserted ?? false };
  }

  /**
   * Recalculate profit for an order based on its linked listing's fee config
   */
  async recalculateProfit(ebayOrderId: string): Promise<void> {
    const orders = await this.databaseService.query<{
      id: string;
      sale_total: number;
      ebay_earnings: number;
      purchase_price: number;
      amazon_tax: number;
      amazon_shipping: number;
      listing_id: string;
    }>(
      `SELECT o.id, o.sale_total, o.ebay_earnings, o.purchase_price,
              o.amazon_tax, o.amazon_shipping, o.listing_id
       FROM orders o
       WHERE o.ebay_order_id = $1 AND o.listing_id IS NOT NULL`,
      [ebayOrderId]
    );

    if (orders.length === 0) {
      return;
    }

    const order = orders[0];

    let purchasePrice = parseFloat(String(order.purchase_price)) || 0;

    // Fallback: if purchase_price is still 0, look up from product
    if (purchasePrice === 0) {
      const productData = await this.productsService.getProductPriceAndImageByListingId(order.listing_id);
      if (productData) {
        purchasePrice = productData.purchasePrice;

        await this.databaseService.query(
          `UPDATE orders SET purchase_price = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND purchase_price = 0`,
          [purchasePrice, order.id]
        );
      }
    }

    // Get fee config from the listing's settings group
    interface FeeRow {
      fees: {
        ebayFeePercent?: number;
        fixedFeeAmount?: number;
        taxPercent?: number;
      } | null;
    }
    const settingsGroups = await this.databaseService.query<FeeRow>(
      `SELECT lsg.fees FROM listing_settings_groups lsg
       INNER JOIN listings l ON l.listing_settings_group_id = lsg.id
       WHERE l.id = $1`,
      [order.listing_id]
    );

    if (settingsGroups.length === 0) {
      return;
    }

    const fees = settingsGroups[0].fees;
    const saleTotal = parseFloat(String(order.sale_total)) || 0;
    const ebayEarnings = parseFloat(String(order.ebay_earnings)) || 0;

    const ebayFeePercent = Number(fees?.ebayFeePercent) || 0;
    const fixedFeeAmount = Number(fees?.fixedFeeAmount) || 0;

    const transactionFee = Math.round(saleTotal * (ebayFeePercent / 100) * 100) / 100;
    const adFee = fixedFeeAmount;

    const amazonTax = parseFloat(String(order.amazon_tax)) || 0;
    const amazonShipping = parseFloat(String(order.amazon_shipping)) || 0;

    // Net profit = actual eBay earnings - Amazon costs
    // ebayEarnings (totalDueSeller) already has eBay commission deducted
    const netProfit = Math.round((ebayEarnings - purchasePrice - amazonTax - amazonShipping) * 100) / 100;

    await this.databaseService.query(
      `UPDATE orders SET
        transaction_fee = $1,
        ad_fee = $2,
        net_profit = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4`,
      [transactionFee, adFee, netProfit, order.id]
    );
  }
}
