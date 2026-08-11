import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  BuyerMessageEventType,
  EbayAccountStatus,
  extractCorrelationId,
  generateCorrelationId,
  OrderStatus,
  PlatformSettingKey,
} from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
import { EbayService } from '../ebay/ebay.service';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { TrackingConversionService } from './tracking-conversion.service';

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
    private readonly trackingQueueService: AmazonTrackingQueueService,
    private readonly buyerMessages: BuyerMessageQueueService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly trackingConversion: TrackingConversionService
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
        // Buyer auto-messaging "shipped" event (fail-soft; env + per-user
        // store config re-checked at send time).
        await this.enqueueBuyerMessage(order, BuyerMessageEventType.SHIPPED);
      } else if (applyStatus && normalizedStatus === OrderStatus.COMPLETED) {
        // Fast deliveries can jump straight past the shipped window between
        // two ticks — make sure eBay got its fulfillment before completing.
        if (previousStatus !== OrderStatus.SHIPPED) {
          await this.handleShipped(order);
        }
        this.logger.log(`Order ${order.id} delivered on Amazon, marking completed`);
        // Buyer auto-messaging "delivered" event + delayed "feedback_request".
        await this.enqueueBuyerMessage(order, BuyerMessageEventType.DELIVERED);
        const delayDays = await this.platformSettings.getNumber(
          PlatformSettingKey.BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS,
        );
        await this.enqueueBuyerMessage(order, BuyerMessageEventType.FEEDBACK_REQUEST, {
          delayMs: delayDays * 86_400_000,
        });
      }

      if (applyStatus) {
        await this.databaseService.query(
          `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [normalizedStatus, orderId]
        );
      }

      // Remove tracking if terminal state (CANCELLED already returned above).
      //
      // Once SHIPPED there are two ways delivery can be detected, and only one
      // of them costs browser time:
      //
      //   * A converted tracking number exists → the provider PUSHES
      //     `shipment.delivered` to `TrackingWebhookController`, so polling
      //     Amazon for the rest of the delivery week buys nothing. Stop the
      //     scheduler entirely. This is the whole point of the integration:
      //     post-shipment polling was ~5 of every ~13 scrapes an order costs.
      //
      //   * No conversion (local provider, or the conversion failed) → keep
      //     scraping, downshifted to the shipped interval. A webhook that will
      //     never arrive must not leave an order stuck in SHIPPED forever.
      if (normalizedStatus === OrderStatus.COMPLETED) {
        await this.trackingQueueService.removeOrderTracking(orderId);
      } else if (applyStatus && normalizedStatus === OrderStatus.SHIPPED) {
        if (await this.hasWebhookDeliveryCoverage(orderId)) {
          this.logger.log(
            `Order ${orderId}: delivery will arrive by provider webhook — stopping Amazon polling`,
          );
          await this.trackingQueueService.removeOrderTracking(orderId);
        } else {
          await this.trackingQueueService.scheduleOrderTracking(
            orderId,
            amazonAccountId,
            OrderStatus.SHIPPED
          );
        }
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

    // Resolve the number the BUYER sees. `TrackingConversionService` owns this
    // because an external conversion is billed, needs the buyer address, and
    // must be persisted before it reaches eBay — this method rethrows on a
    // failed push so the next tick retries, and an unstored conversion would
    // be re-bought and hand eBay a different number each time.
    //
    //   LOCAL     → Amazon number passes through as Amazon_Logistics.
    //   AQUILINE  → AQUAA…YQ number under the AQUILINE carrier, which eBay's
    //               Add-Tracking form accepts (verified 2026-08-11).
    //
    // Any provider failure degrades to the pass-through rather than blocking
    // the fulfilment: late-but-honest tracking beats no tracking at all.
    const { trackingNumber, shippingCarrierCode } = await this.trackingConversion.resolveForOrder({
      orderId: order.id,
      rawNumber: order.amazon_tracking_number || '',
      rawCarrier: order.amazon_tracking_carrier || '',
    });

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

  /**
   * Enqueue a buyer auto-message for an order lifecycle event. Fully fail-soft
   * — messaging can never break the tracking pipeline (enqueue swallows its own
   * errors; the .catch here is defense-in-depth). The per-user/per-event
   * store_settings config is the sole gate (checked by the worker at fire
   * time), so there is no env master switch to consult here.
   */
  private async enqueueBuyerMessage(
    order: AmazonOrderRow,
    event: BuyerMessageEventType,
    opts?: { delayMs?: number },
  ): Promise<void> {
    await this.buyerMessages
      .enqueue(
        {
          ebayOrderId: order.ebay_order_id,
          userId: order.user_id,
          ebayAccountId: order.ebay_account_id,
          storeId: null,
          event,
        },
        opts,
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `Buyer-message ${event} enqueue skipped for order ${order.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
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
   * Whether this order's delivery will be pushed to us by the tracking
   * provider, making further Amazon scraping redundant.
   *
   * Keyed on the STORED converted number rather than on the configured
   * provider: the configuration says what we intended, the column says what
   * actually happened. A conversion that failed (quota, outage, incomplete
   * buyer address) leaves the column NULL, and those orders must keep polling
   * — otherwise a webhook that will never arrive would strand them in SHIPPED.
   *
   * Fail-closed: any error answers "no coverage", i.e. keep polling. The cost
   * of being wrong that way is some browser time; the cost of the opposite is
   * an order that never completes.
   */
  private async hasWebhookDeliveryCoverage(orderId: string): Promise<boolean> {
    try {
      // BOTH conditions are required, and the second one is the one that is
      // easy to forget. A converted number only means the provider COULD push
      // to us; a configured webhook secret means a receiver actually exists
      // that can accept the push (`TrackingWebhookController` returns 401 for
      // every request when the secret is unset).
      //
      // Checking only the number is a stuck-order bug: enable conversion,
      // forget the webhook, and every order sits in SHIPPED forever because
      // nothing is left to notice delivery.
      const secret = await this.platformSettings.getString(
        PlatformSettingKey.AQUILINE_WEBHOOK_SECRET,
      );
      if (!secret) {
        return false;
      }

      const rows = await this.databaseService.query<{ converted_tracking_number: string | null }>(
        `SELECT converted_tracking_number FROM orders WHERE id = $1`,
        [orderId],
      );
      return Boolean(rows[0]?.converted_tracking_number);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Order ${orderId}: could not check webhook coverage (${message}) — keeping Amazon polling on`,
      );
      return false;
    }
  }
}
