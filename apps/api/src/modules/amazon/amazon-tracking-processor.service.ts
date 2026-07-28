import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  EbayAccountStatus,
  extractCorrelationId,
  generateCorrelationId,
  OrderStatus,
  TrackingConversionProvider,
} from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { EbayService } from '../ebay/ebay.service';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { resolveConverter } from './tracking-converter';

interface TrackAmazonOrderData {
  orderId: string;
  amazonAccountId: string;
}

interface AmazonOrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  ebay_order_id: string;
  status: OrderStatus;
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
  status: EbayAccountStatus;
}

@Processor('amazon-tracking', { concurrency: 2 })
export class AmazonTrackingProcessorService extends WorkerHost {
  private readonly logger = new Logger(AmazonTrackingProcessorService.name);

  constructor(
    private readonly scrapingService: AmazonScrapingService,
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
    private readonly ebayFulfillmentService: EbayFulfillmentService,
    private readonly trackingQueueService: AmazonTrackingQueueService
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'amazon-tracking',
        jobId: job.id,
        origin: 'worker',
      },
      () => this.processTracking(job)
    );
  }

  private async processTracking(job: Job): Promise<void> {
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

      // Skip if already in a terminal state
      if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(order.status)) {
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

      // Update tracking info if we got new data — and mirror it into the
      // in-memory row so the shipped transition below pushes the FRESH
      // tracking number to eBay (the row was read before this scrape; on the
      // very first shipped detection the row's tracking columns are still
      // empty, and pushing those would create a no-tracking fulfillment).
      if (amazonStatus.trackingNumber && amazonStatus.trackingNumber !== order.amazon_tracking_number) {
        await this.databaseService.query(
          `UPDATE orders SET
            amazon_tracking_number = $1,
            amazon_tracking_carrier = $2,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [amazonStatus.trackingNumber, amazonStatus.trackingCarrier || null, orderId]
        );
        order.amazon_tracking_number = amazonStatus.trackingNumber;
        order.amazon_tracking_carrier = amazonStatus.trackingCarrier || '';
      }

      // Amazon-side cancellation is NOT an eBay-side cancellation: the eBay
      // sale is still live and must be fulfilled another way. Never overwrite
      // the local order status — stamp amazon_cancelled_at (surfaces in the
      // "needs attention" filter), stop tracking, and leave the order as-is
      // for the operator.
      if (normalizedStatus === OrderStatus.CANCELLED) {
        this.logger.warn(
          `Order ${orderId}: AMAZON purchase ${order.amazon_order_id} observed cancelled — ` +
            `flagging for attention (local eBay order status unchanged)`,
        );
        await this.databaseService.query(
          `UPDATE orders SET
             amazon_cancelled_at = COALESCE(amazon_cancelled_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [orderId]
        );
        await this.trackingQueueService.removeOrderTracking(orderId);
        return;
      }

      // Status transitions are guarded against regression: a parse miss on
      // Amazon's side (parser falls back to 'pending' → WAITING_SHIPMENT)
      // must never downgrade a SHIPPED order — that would re-trigger the
      // shipped transition on a later tick and push a DUPLICATE fulfillment
      // to eBay. Compare against enum constants, not raw string literals.
      const applyStatus = this.shouldApplyStatus(previousStatus, normalizedStatus);

      if (applyStatus && normalizedStatus === OrderStatus.SHIPPED) {
        // Throws on eBay push failure → the status write below is skipped and
        // the next scheduler tick retries the push (still pre-SHIPPED).
        await this.handleShipped(order);
      } else if (applyStatus && normalizedStatus === OrderStatus.COMPLETED) {
        // Fast deliveries can jump straight past the shipped window between
        // two ticks — make sure eBay got its fulfillment before completing.
        if (previousStatus !== OrderStatus.SHIPPED) {
          await this.handleShipped(order);
        }
        this.logger.log(`Order ${order.id} delivered on Amazon, marking completed`);
      }

      if (applyStatus) {
        await this.databaseService.query(
          `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [normalizedStatus, orderId]
        );
      }

      // Remove tracking if terminal state (CANCELLED already returned above);
      // slow the poll to 12h once shipped (waiting for delivery needs less
      // frequent — and cheaper — scraping).
      if (normalizedStatus === OrderStatus.COMPLETED) {
        await this.trackingQueueService.removeOrderTracking(orderId);
      } else if (applyStatus && normalizedStatus === OrderStatus.SHIPPED) {
        await this.trackingQueueService.scheduleOrderTracking(
          orderId,
          amazonAccountId,
          OrderStatus.SHIPPED
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Amazon tracking failed for order ${orderId}: ${message}`);
      throw error;
    }
  }

  /**
   * Push the shipped fulfillment (tracking number + carrier) to eBay.
   *
   * Failure semantics: permanently-unpushable conditions (account gone /
   * inactive / no linked listing item) log and return, letting the caller
   * advance the local status. A FAILED eBay API call (401/5xx/network)
   * PROPAGATES instead — the caller then skips the status write, so the
   * order is still pre-SHIPPED on the next scheduler tick and the push is
   * retried. Swallowing here would mark the order shipped locally while eBay
   * never received the tracking — an unrecoverable silent drop.
   */
  private async handleShipped(order: AmazonOrderRow): Promise<void> {
    this.logger.log(`Order ${order.id} shipped on Amazon, syncing to eBay`);

    // Get eBay account for API call
    const ebayAccounts = await this.databaseService.query<EbayAccountRow>(
      `SELECT id, status FROM ebay_accounts WHERE id = $1`,
      [order.ebay_account_id]
    );

    if (ebayAccounts.length === 0) {
      this.logger.error(`eBay account ${order.ebay_account_id} not found for order ${order.id}`);
      return;
    }

    const ebayAccount = ebayAccounts[0];

    if (ebayAccount.status !== EbayAccountStatus.ACTIVE) {
      this.logger.error(`eBay account ${ebayAccount.id} is not active`);
      return;
    }

    // Get the eBay line item ID from the linked listing
    const lineItemId = order.listing_ebay_item_id;
    if (!lineItemId) {
      this.logger.error(`No eBay item ID for order ${order.id}`);
      return;
    }

    // Fresh access token, refreshed on demand. eBay access tokens live ~2h;
    // this job fires 6–12h after order sync, so the raw ebay_accounts column
    // value is virtually always expired by the time we push.
    const accessToken = await this.ebayService.getAccountAccessToken(order.ebay_account_id);

    // Create shipping fulfillment on eBay.
    // Tracking number/carrier go through the pluggable TrackingConverter:
    //   - Real carriers (UPS/USPS/FedEx/DHL) are remapped to eBay's enum.
    //   - TBA/TBM/TBC (Amazon Logistics) pass through UNCHANGED as
    //     Amazon_Logistics — never fabricated into a fake USPS/UPS number
    //     (eBay deprecated Bluecare/Aquiline validation; fabrication is fraud).
    // The provider is resolved per-order from store_settings (default LOCAL).
    const provider = await this.resolveProvider(order.user_id);
    const converter = resolveConverter(provider);
    const { trackingNumber, shippingCarrierCode } = converter.convert(
      order.amazon_tracking_number || '',
      order.amazon_tracking_carrier || '',
    );

    await this.ebayFulfillmentService.createShippingFulfillment(
      accessToken,
      order.ebay_order_id,
      lineItemId,
      order.quantity || 1,
      {
        // Preserve "no tracking number = no tracking body" semantic —
        // EbayFulfillmentService only attaches tracking when BOTH fields
        // are truthy, so empty strings collapse to undefined here.
        trackingNumber: trackingNumber || undefined,
        shippingCarrierCode: shippingCarrierCode || undefined,
        shippedDate: new Date().toISOString(),
      }
    );

    this.logger.log(`eBay order ${order.ebay_order_id} marked as shipped`);
  }

  /**
   * Whether an Amazon-observed status may overwrite the local order status.
   * Blocks no-op writes, any change out of a terminal state, and — most
   * importantly — regression of a SHIPPED order to a pre-ship state (the
   * parser's 'pending' fallback on a layout miss must not rewind the order
   * and cause a duplicate shipped transition later).
   */
  private shouldApplyStatus(prev: OrderStatus, next: OrderStatus): boolean {
    if (prev === next) {
      return false;
    }
    if (prev === OrderStatus.COMPLETED || prev === OrderStatus.CANCELLED) {
      return false;
    }
    if (
      prev === OrderStatus.SHIPPED &&
      next !== OrderStatus.COMPLETED &&
      next !== OrderStatus.CANCELLED
    ) {
      return false;
    }
    return true;
  }

  private mapAmazonStatus(status: string): OrderStatus {
    const lower = status.toLowerCase();
    if (lower === 'shipped' || lower.includes('on the way')) {return OrderStatus.SHIPPED;}
    if (lower === 'delivered' || lower.includes('arrived')) {return OrderStatus.COMPLETED;}
    if (lower === 'cancelled') {return OrderStatus.CANCELLED;}
    if (lower === 'processing' || lower.includes('preparing')) {return OrderStatus.PROCESSING;}
    return OrderStatus.WAITING_SHIPMENT;
  }

  /**
   * Resolve the user's tracking-conversion provider from store_settings.
   *
   * Fail-closed: returns LOCAL on any miss/error/unknown value — settings
   * resolution must never break the tracking pipeline. Direct query (instead
   * of injecting StoreSettingsService) because (a) StoreSettingsResponse does
   * not yet expose `trackingConversionProvider` (added in Task 5), so the
   * typed-API path would require a cast; and (b) handleShipped already runs
   * direct queries against orders/ebay_accounts — this stays consistent and
   * avoids growing the AmazonModule import graph for a single column read.
   * Migration `036` provides the column (default 'local').
   */
  private async resolveProvider(userId: string): Promise<TrackingConversionProvider> {
    try {
      const rows = await this.databaseService.query<{ tracking_conversion_provider: string }>(
        `SELECT tracking_conversion_provider
           FROM store_settings
          WHERE user_id = $1 AND is_global = TRUE
          LIMIT 1`,
        [userId],
      );
      const raw = rows[0]?.tracking_conversion_provider;
      // Compare to the string literal `'api'` (not the enum) to avoid
      // `no-unsafe-enum-comparison` between the DB-side string and the enum.
      if (raw === 'api') {
        return TrackingConversionProvider.API;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to resolve tracking provider for user ${userId}: ${message}; defaulting to LOCAL`,
      );
    }
    return TrackingConversionProvider.LOCAL;
  }
}
