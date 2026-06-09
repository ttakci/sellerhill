import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { OrderStatus } from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';

interface TrackAmazonOrderData {
  orderId: string;
  amazonAccountId: string;
}

interface AmazonOrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  ebay_order_id: string;
  status: string;
  amazon_order_id: string;
  amazon_account_id: string;
  amazon_tracking_number: string;
  amazon_tracking_carrier: string;
  listing_id: string | null;
  quantity: number;
  // From listing JOIN (ebay_item_id was removed from orders)
  listing_ebay_item_id: string | null;
}

interface EbayAccountRow {
  id: string;
  access_token: string;
  marketplace_id: string;
  status: string;
}

@Processor('amazon-tracking', { concurrency: 2 })
export class AmazonTrackingProcessorService extends WorkerHost {
  private readonly logger = new Logger(AmazonTrackingProcessorService.name);

  constructor(
    private readonly scrapingService: AmazonScrapingService,
    private readonly databaseService: DatabaseService,
    private readonly ebayFulfillmentService: EbayFulfillmentService,
    private readonly trackingQueueService: AmazonTrackingQueueService
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'track-amazon-order') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const { orderId, amazonAccountId } = job.data as TrackAmazonOrderData;

    this.logger.log(`Tracking Amazon order for order ${orderId}`);

    try {
      // Get the order
      const orders = await this.databaseService.query<AmazonOrderRow>(
        `SELECT o.id, o.user_id, o.ebay_account_id, o.ebay_order_id, o.status,
                o.amazon_order_id, o.amazon_account_id, o.amazon_tracking_number,
                o.amazon_tracking_carrier, o.listing_id, o.quantity,
                l.ebay_item_id as listing_ebay_item_id
         FROM orders o
         LEFT JOIN listings l ON o.listing_id = l.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orders.length === 0) {
        this.logger.warn(`Order ${orderId} not found, removing tracking`);
        await this.trackingQueueService.removeOrderTracking(orderId);
        return;
      }

      const order = orders[0];

      // Skip if already delivered/completed/cancelled
      if (['completed', 'cancelled', 'delivered'].includes(order.status)) {
        this.logger.log(`Order ${orderId} is ${order.status}, removing tracking`);
        await this.trackingQueueService.removeOrderTracking(orderId);
        return;
      }

      // Scrape current status from Amazon
      const amazonStatus = await this.scrapingService.scrapeOrderStatus(
        order.user_id,
        amazonAccountId,
        order.amazon_order_id
      );

      const previousStatus = order.status;
      const normalizedStatus = this.mapAmazonStatus(amazonStatus.status);

      this.logger.log(`Order ${orderId}: Amazon status=${amazonStatus.status}, mapped=${normalizedStatus}, previous=${previousStatus}`);

      // Update tracking info if we got new data
      if (amazonStatus.trackingNumber && amazonStatus.trackingNumber !== order.amazon_tracking_number) {
        await this.databaseService.query(
          `UPDATE orders SET
            amazon_tracking_number = $1,
            amazon_tracking_carrier = $2,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [amazonStatus.trackingNumber, amazonStatus.trackingCarrier || null, orderId]
        );
      }

      // Handle status transitions
      if (normalizedStatus === 'shipped' && previousStatus !== 'shipped') {
        await this.handleShipped(order);
      } else if (normalizedStatus === 'delivered' && previousStatus !== 'delivered') {
        await this.handleDelivered(order);
      }

      // Update order status
      await this.databaseService.query(
        `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [normalizedStatus, orderId]
      );

      // Remove tracking if terminal state
      if (['completed', 'delivered'].includes(normalizedStatus)) {
        await this.trackingQueueService.removeOrderTracking(orderId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Amazon tracking failed for order ${orderId}: ${message}`);
      throw error;
    }
  }

  private async handleShipped(order: AmazonOrderRow): Promise<void> {
    this.logger.log(`Order ${order.id} shipped on Amazon, syncing to eBay`);

    try {
      // Get eBay account for API call
      const ebayAccounts = await this.databaseService.query<EbayAccountRow>(
        `SELECT id, access_token, marketplace_id, status FROM ebay_accounts WHERE id = $1`,
        [order.ebay_account_id]
      );

      if (ebayAccounts.length === 0) {
        this.logger.error(`eBay account ${order.ebay_account_id} not found for order ${order.id}`);
        return;
      }

      const ebayAccount = ebayAccounts[0];

      if (ebayAccount.status !== 'active') {
        this.logger.error(`eBay account ${ebayAccount.id} is not active`);
        return;
      }

      // Get the eBay line item ID from the linked listing
      const lineItemId = order.listing_ebay_item_id;
      if (!lineItemId) {
        this.logger.error(`No eBay item ID for order ${order.id}`);
        return;
      }

      // Create shipping fulfillment on eBay
      // For now: forward the Amazon tracking number directly
      // Future: replace with generated fake tracking ID for dropshipping
      await this.ebayFulfillmentService.createShippingFulfillment(
        ebayAccount.access_token,
        order.ebay_order_id,
        lineItemId,
        order.quantity || 1,
        {
          trackingNumber: order.amazon_tracking_number || undefined,
          shippingCarrierCode: this.mapCarrierForEbay(order.amazon_tracking_carrier),
          shippedDate: new Date().toISOString(),
        }
      );

      await this.databaseService.query(
        `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [OrderStatus.SHIPPED, order.id]
      );

      this.logger.log(`eBay order ${order.ebay_order_id} marked as shipped`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to sync shipped status to eBay for order ${order.id}: ${message}`);
    }
  }

  private async handleDelivered(order: AmazonOrderRow): Promise<void> {
    this.logger.log(`Order ${order.id} delivered on Amazon, syncing to eBay`);

    // eBay doesn't have a direct "mark as delivered" API
    // The order transitions to COMPLETED after the buyer confirms or after a timeout
    await this.databaseService.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [OrderStatus.COMPLETED, order.id]
    );

    this.logger.log(`Order ${order.id} marked as completed (delivered on Amazon)`);
  }

  private mapAmazonStatus(status: string): string {
    const lower = status.toLowerCase();
    if (lower === 'shipped' || lower.includes('on the way')) {return OrderStatus.SHIPPED;}
    if (lower === 'delivered' || lower.includes('arrived')) {return OrderStatus.COMPLETED;}
    if (lower === 'cancelled') {return OrderStatus.CANCELLED;}
    if (lower === 'processing' || lower.includes('preparing')) {return OrderStatus.PROCESSING;}
    return OrderStatus.WAITING_SHIPMENT;
  }

  private mapCarrierForEbay(carrier?: string): string | undefined {
    if (!carrier) {return undefined;}
    const lower = carrier.toLowerCase();
    if (lower.includes('usps')) {return 'USPS';}
    if (lower.includes('ups')) {return 'UPS';}
    if (lower.includes('fedex')) {return 'FedEx';}
    if (lower.includes('dhl')) {return 'DHL_Express';}
    if (lower.includes('amazon')) {return 'Amazon_Logistics';}
    return carrier;
  }
}
