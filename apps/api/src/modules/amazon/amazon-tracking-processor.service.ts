import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  BuyerMessageEventType,
  ConversionOutcome,
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
import { DEFERRAL_RETRY_INTERVAL_HOURS, DEFERRAL_WINDOW_HOURS, shouldDeferEbayPush } from './tracking-deferral';

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
  // Start of the bounded deferral window — first time this order was
  // observed SHIPPED. Stamped with COALESCE so a retry never resets it.
  shipped_detected_at: Date | null;
}

interface EbayAccountRow {
  id: string;
  status: EbayAccountStatus;
}

/** Result of attempting the shipped-transition eBay push. */
interface ShippedPushResult {
  /** True only when the eBay Fulfillment API call actually happened and
   *  succeeded — never true for a deferral or a permanently-unpushable order. */
  pushed: boolean;
  /** Set only when the push was deferred (retryable conversion failure,
   *  still inside the bounded window). Its presence — not `pushed` — is what
   *  tells the caller to skip the status write and re-arm the scheduler. */
  retryAt?: Date;
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
                o.shipped_detected_at,
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

      // Scrape current status from Amazon. The tracking-HTML variant also
      // captures the ship-track page (same rate-limiter slot) — Aquiline
      // wants that HTML roughly daily for an in-flight order, and its own
      // `assign` call needs the real tracking URL Amazon renders, which a
      // constructed URL cannot reproduce for a multi-package shipment.
      const amazonStatus = await this.scrapingService.scrapeOrderStatusWithTrackingHtml(
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
        order.shipped_detected_at = await this.stampShippedDetected(orderId);
        const result = await this.handleShipped(order, amazonStatus.trackingUrl, amazonStatus.trackingHtml);
        if (result.retryAt) {
          await this.deferShippedPush(orderId, amazonAccountId, previousStatus);
          return;
        }
        // Buyer auto-messaging "shipped" event only when the push actually
        // happened (fail-soft; env + per-user store config re-checked at
        // send time). A permanently-unpushable order (dead account, no
        // linked item) still advances status below, but we never told eBay
        // it shipped, so telling the buyer would be dishonest too.
        if (result.pushed) {
          await this.enqueueBuyerMessage(order, BuyerMessageEventType.SHIPPED);
        }
      } else if (applyStatus && normalizedStatus === OrderStatus.COMPLETED) {
        // Fast deliveries can jump straight past the shipped window between
        // two ticks — make sure eBay got its fulfillment before completing.
        if (previousStatus !== OrderStatus.SHIPPED) {
          order.shipped_detected_at = await this.stampShippedDetected(orderId);
          const result = await this.handleShipped(order, amazonStatus.trackingUrl, amazonStatus.trackingHtml);
          if (result.retryAt) {
            await this.deferShippedPush(orderId, amazonAccountId, previousStatus);
            return;
          }
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
      // Otherwise keep scraping at the shipped interval — the Integration
      // API has NO delivery webhook (only tracking.html.* / tracking.problem.*
      // events), so a converted number must never stop Amazon polling; doing
      // so would strand the order in SHIPPED forever. Continued polling also
      // feeds Aquiline the ship-track HTML it wants roughly daily.
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
   * Skip the status write and re-arm the scheduler tighter than the normal
   * pre-ship interval, so the bounded deferral window (see
   * `tracking-deferral.ts`) gets several chances rather than one or two.
   *
   * This is a normal, expected wait — NOT a failure — so it returns rather
   * than throwing. Throwing here would fail the BullMQ job and pollute queue
   * failure metrics for something that is not an error.
   */
  private async deferShippedPush(
    orderId: string,
    amazonAccountId: string,
    previousStatus: OrderStatus,
  ): Promise<void> {
    this.logger.log(
      `Order ${orderId}: deferring the eBay tracking push, retrying in ${DEFERRAL_RETRY_INTERVAL_HOURS}h`,
    );
    await this.trackingQueueService.scheduleOrderTracking(
      orderId,
      amazonAccountId,
      previousStatus,
      DEFERRAL_RETRY_INTERVAL_HOURS,
    );
  }

  /** First-observation stamp for the deferral window (COALESCE — a retry on
   *  a later tick must never reset the clock). Returns the resolved value so
   *  the caller can pass it straight into `shouldDeferEbayPush`. */
  private async stampShippedDetected(orderId: string): Promise<Date | null> {
    const rows = await this.databaseService.query<{ shipped_detected_at: Date | null }>(
      `UPDATE orders SET
         shipped_detected_at = COALESCE(shipped_detected_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING shipped_detected_at`,
      [orderId]
    );
    return rows[0]?.shipped_detected_at ?? null;
  }

  /**
   * Push the shipped fulfillment (tracking number + carrier) to eBay.
   *
   * Three outcomes:
   *   - Permanently-unpushable conditions (account gone / inactive / no
   *     linked listing item) log and return `{ pushed: false }`, letting the
   *     caller advance the local status — retrying changes nothing.
   *   - A RETRYABLE conversion failure, still inside the bounded deferral
   *     window, returns `{ pushed: false, retryAt }` WITHOUT calling eBay at
   *     all. eBay's Fulfillment API has no update endpoint, so the first
   *     push is the only chance to hand the buyer a converted number.
   *   - Otherwise the eBay call is made. A FAILED eBay API call (401/5xx/
   *     network) PROPAGATES instead of being caught here — the caller then
   *     skips the status write, so the order is still pre-SHIPPED on the
   *     next scheduler tick and the push is retried. Swallowing here would
   *     mark the order shipped locally while eBay never received the
   *     tracking — an unrecoverable silent drop.
   */
  private async handleShipped(
    order: AmazonOrderRow,
    trackingUrl?: string,
    trackingHtml?: string
  ): Promise<ShippedPushResult> {
    this.logger.log(`Order ${order.id} shipped on Amazon, syncing to eBay`);

    // Get eBay account for API call
    const ebayAccounts = await this.databaseService.query<EbayAccountRow>(
      `SELECT id, status FROM ebay_accounts WHERE id = $1`,
      [order.ebay_account_id]
    );

    if (ebayAccounts.length === 0) {
      this.logger.error(`eBay account ${order.ebay_account_id} not found for order ${order.id}`);
      return { pushed: false };
    }

    const ebayAccount = ebayAccounts[0];

    if (ebayAccount.status !== EbayAccountStatus.ACTIVE) {
      this.logger.error(`eBay account ${ebayAccount.id} is not active`);
      return { pushed: false };
    }

    // Get the eBay line item ID from the linked listing
    const lineItemId = order.listing_ebay_item_id;
    if (!lineItemId) {
      this.logger.error(`No eBay item ID for order ${order.id}`);
      return { pushed: false };
    }

    // Resolve the number the BUYER sees. `TrackingConversionService` owns this
    // because an external conversion is billed, needs the buyer address, and
    // must be persisted before it reaches eBay.
    //
    //   LOCAL     → Amazon number passes through as Amazon_Logistics.
    //   AQUILINE  → AQUAA…YQ number under the AQUILINE carrier, which eBay's
    //               Add-Tracking form accepts (verified 2026-08-11).
    //
    // Any provider failure degrades to the pass-through rather than blocking
    // the fulfilment: late-but-honest tracking beats no tracking at all.
    const conversion = await this.trackingConversion.resolveForOrder({
      orderId: order.id,
      rawNumber: order.amazon_tracking_number || '',
      rawCarrier: order.amazon_tracking_carrier || '',
      trackingUrl,
      trackingHtml,
    });

    // Whether `assign` succeeds immediately after an `accepted` HTML upload
    // is unresolved with the provider — its own docs warn against treating
    // success alone as applied. `PASSTHROUGH_RETRYABLE` mirrors
    // `isRetryableConversionFailure`'s classification (transport blip, "HTML
    // not parsed yet"). Deferring is bounded: a shipment with NO tracking
    // number is worse than one with the raw Amazon number, so past the
    // window the push goes through with whatever number is available.
    const retryable = conversion.outcome === ConversionOutcome.PASSTHROUGH_RETRYABLE;
    if (
      shouldDeferEbayPush({
        retryable,
        shippedDetectedAt: order.shipped_detected_at,
        now: new Date(),
        windowHours: DEFERRAL_WINDOW_HOURS,
      })
    ) {
      this.logger.log(
        `Order ${order.id}: tracking conversion is retryable and still inside the ` +
          `${DEFERRAL_WINDOW_HOURS}h deferral window — holding the eBay push`,
      );
      return {
        pushed: false,
        retryAt: new Date(Date.now() + DEFERRAL_RETRY_INTERVAL_HOURS * 3_600_000),
      };
    }

    // Fresh access token, refreshed on demand. eBay access tokens live ~2h;
    // this job fires 6–24h after order sync, so the raw ebay_accounts column
    // value is virtually always expired by the time we push.
    const accessToken = await this.ebayService.getAccountAccessToken(order.ebay_account_id);

    const { trackingNumber, shippingCarrierCode } = conversion;

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

    // Record what eBay actually received. eBay's Fulfillment API has no
    // update endpoint, so once this is set the buyer's number can never be
    // corrected — a later on-demand conversion refuses to run once it sees
    // this column populated.
    await this.databaseService.query(
      `UPDATE orders SET
         ebay_tracking_pushed_number = $1,
         ebay_tracking_pushed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [trackingNumber || null, order.id]
    );

    this.logger.log(`eBay order ${order.ebay_order_id} marked as shipped`);
    return { pushed: true };
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
}
