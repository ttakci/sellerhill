/**
 * Order Sync Service
 * Handles periodic syncing of eBay orders to our database.
 * Only syncs orders created after the user connected their eBay account.
 * Orders from listings not in our system are marked as untracked.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EbayAccountStatus, ListingStatus, type EbayMarketplaceId } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayService } from '../ebay/ebay.service';

import { EbayFulfillmentService } from './ebay-fulfillment.service';

export interface EbayAccountForSync {
  id: string;
  user_id: string;
  marketplace_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  created_at: Date;
  status: string;
}

@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
    private readonly fulfillmentService: EbayFulfillmentService
  ) {}

  /**
   * Sync orders for all users with active eBay accounts
   */
  async syncOrdersForAllUsers(): Promise<void> {
    this.logger.log('Starting order sync for all users');

    const accounts = await this.databaseService.query<EbayAccountForSync>(
      `SELECT id, user_id, marketplace_id, access_token, refresh_token,
              access_token_expires_at, created_at, status
       FROM ebay_accounts WHERE status = '${EbayAccountStatus.ACTIVE}'`
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
        this.logger.error(
          `Order sync failed for account ${account.id} (user: ${account.user_id}): ${message}`
        );
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

    // Only fetch orders created after the account was connected
    const connectedDate = account.created_at.toISOString();
    let totalSynced = 0;
    let cursor: string | undefined;

    do {
      const result = await this.fulfillmentService.fetchOrders(accessToken, marketplaceId, {
        fromDateString: connectedDate,
        limit: 50,
        cursor,
      });

      for (const ebayOrder of result.orders) {
        try {
          // Try to match this order's line items to our listings
          const lineItem = ebayOrder.lineItems?.[0];
          let listingId: string | null = null;
          let asin: string | null = null;

          if (lineItem?.itemId) {
            const match = await this.databaseService.query<{ id: string; asin: string | null }>(
              `SELECT id, asin FROM listings
               WHERE ebay_item_id = $1 AND user_id = $2 AND status = '${ListingStatus.ACTIVE}'
               LIMIT 1`,
              [lineItem.itemId, userId]
            );

            if (match.length > 0) {
              listingId = match[0].id;
              asin = match[0].asin;
            }
          }

          const entity = this.fulfillmentService.mapEbayOrderToEntity(
            ebayOrder,
            userId,
            ebayAccountId,
            listingId || undefined,
            asin || undefined
          );

          await this.upsertOrder(entity);

          // Calculate profit for tracked orders
          if (listingId) {
            await this.recalculateProfit(entity.ebayOrderId);
          }

          totalSynced++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to sync eBay order ${ebayOrder.orderId}: ${msg}`
          );
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

    this.logger.log(`Synced ${totalSynced} orders for user ${userId}`);
    return totalSynced;
  }

  /**
   * Insert or update an order from eBay data
   */
  private async upsertOrder(entity: ReturnType<EbayFulfillmentService['mapEbayOrderToEntity']>): Promise<string> {
    const result = await this.databaseService.query<{ id: string }>(
      `INSERT INTO orders (
        user_id, ebay_account_id, ebay_order_id, order_number,
        buyer_username, buyer_name, buyer_email, buyer_phone,
        status, order_fulfillment_status, payment_status,
        listing_id, asin, ebay_item_id, sku, product_title, product_image_url,
        quantity, is_tracked,
        sale_price, sale_shipping, sale_tax, sale_total, ebay_earnings,
        purchase_price, transaction_fee, ad_fee, net_profit,
        shipping_address,
        ebay_created_at, ebay_updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31
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
        ebay_updated_at = EXCLUDED.ebay_updated_at,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        entity.userId,
        entity.ebayAccountId,
        entity.ebayOrderId,
        entity.orderNumber,
        entity.buyerUsername,
        entity.buyerName,
        entity.buyerEmail,
        entity.buyerPhone,
        entity.status,
        entity.orderFulfillmentStatus,
        entity.paymentStatus,
        entity.listingId,
        entity.asin,
        entity.ebayItemId,
        entity.sku,
        entity.productTitle,
        entity.productImageUrl,
        entity.quantity,
        entity.isTracked,
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
        entity.ebayCreatedAt,
        entity.ebayUpdatedAt,
      ]
    );

    return result[0]?.id;
  }

  /**
   * Recalculate profit for an order based on its linked listing's fee config
   */
  async recalculateProfit(ebayOrderId: string): Promise<void> {
    // Get order with its listing's fee configuration
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
       WHERE o.ebay_order_id = $1 AND o.is_tracked = true AND o.listing_id IS NOT NULL`,
      [ebayOrderId]
    );

    if (orders.length === 0) {return;}

    const order = orders[0];

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

    if (settingsGroups.length === 0) {return;}

    const fees = settingsGroups[0].fees;
    const saleTotal = parseFloat(String(order.sale_total)) || 0;
    const ebayEarnings = parseFloat(String(order.ebay_earnings)) || 0;

    // Calculate fees
    const ebayFeePercent = Number(fees?.ebayFeePercent) || 0;
    const fixedFeeAmount = Number(fees?.fixedFeeAmount) || 0;
    const _taxPercent = Number(fees?.taxPercent) || 0;

    const transactionFee = Math.round(saleTotal * (ebayFeePercent / 100) * 100) / 100;
    const adFee = fixedFeeAmount;

    // Purchase side
    const purchasePrice = parseFloat(String(order.purchase_price)) || 0;
    const amazonTax = parseFloat(String(order.amazon_tax)) || 0;
    const amazonShipping = parseFloat(String(order.amazon_shipping)) || 0;
    const amazonTotal = purchasePrice + amazonTax + amazonShipping;

    // Net profit = eBay earnings - Amazon total - fees
    const netProfit = Math.round((ebayEarnings - amazonTotal - transactionFee - adFee) * 100) / 100;

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
