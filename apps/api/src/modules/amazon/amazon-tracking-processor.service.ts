import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  BuyerMessageEventType,
  ConversionOutcome,
  mayPushToEbay,
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
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
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
    private readonly trackingConversion: TrackingConversionService,
    private readonly quotaEnforcement: QuotaEnforcementService
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

      // Suspension stops the scrape, NOT the scheduler. The scrape is the cost
      // (~330-450s of the shared Playwright pool per order); the scheduler is one
      // lookup per tick. Leaving it registered means the very next tick after
      // payment resumes this order exactly where it stopped, with no restart and
      // no manual action.
      if (await this.quotaEnforcement.isSuspended(order.user_id)) {
        this.logger.log(
          `Tracking scrape skipped for order ${order.id}: subscription suspended (scheduler retained)`
        );
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

      // Persist the ship-track URL Amazon itself rendered. Until now only the
      // MANUAL link path ever wrote `orders.amazon_tracking_url`, so for an
      // auto-fulfilled order the column stayed NULL — and `convertOnDemand`,
      // which has no live page and falls back to that column, refused with
      // `conversionUnavailable`. The documented recovery path for a failed
      // conversion therefore failed on exactly the orders that need it.
      // Best-effort: a diagnostic URL is never worth failing a tracking tick.
      await this.storeTrackingUrl(orderId, amazonStatus.trackingUrl);

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

      // Recurring ship-track HTML feed (spec 5.3). Aquiline wants fresh HTML
      // roughly 1-2x per day for an in-flight order so its carrier and
      // delivery context stay current; without it the provider's view of the
      // shipment goes stale. The only tick that used to upload was the shipped
      // TRANSITION, and `shouldApplyStatus` makes sure that runs exactly once.
      //
      // Gated on the order ALREADY being SHIPPED coming into this tick, which
      // covers both cases in one condition and cannot double-upload: while it
      // is still SHIPPED this is the recurring feed, and on the delivered
      // transition (SHIPPED -> COMPLETED) it is the final upload that makes the
      // provider's last state match reality. When the previous status was NOT
      // shipped, `handleShipped` ran above and did its own upload as part of
      // the conversion, so there is nothing to repeat here.
      //
      // It pushes NOTHING to eBay and changes NO status — it is a payload
      // refresh on a shipment the provider already owns.
      if (previousStatus === OrderStatus.SHIPPED) {
        await this.refreshTrackingHtml(order, amazonStatus.trackingUrl, amazonStatus.trackingHtml);
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
   * Record the real ship-track URL on the order. It is written for BOTH the
   * automatic and the manual path so `convertOnDemand` — which has no live
   * Amazon page and reads `orders.amazon_tracking_url` as its only source for
   * the URL `assign` requires — can actually run on an auto-fulfilled order.
   *
   * `IS DISTINCT FROM` keeps a re-scrape of an unchanged URL from writing, and
   * every failure is swallowed: this is a diagnostic/recovery aid, and losing
   * it must never fail a tracking tick that is otherwise doing real work.
   */
  private async storeTrackingUrl(orderId: string, trackingUrl?: string): Promise<void> {
    if (!trackingUrl) {
      return;
    }
    try {
      await this.databaseService.query(
        `UPDATE orders SET
           amazon_tracking_url = $1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND amazon_tracking_url IS DISTINCT FROM $1`,
        [trackingUrl, orderId],
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Order ${orderId}: could not store the Amazon ship-track URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Hand the provider a fresh copy of the ship-track page for an order it has
   * already issued a number for. Delegates to `TrackingConversionService`,
   * which owns every provider call, the profile lookup and the
   * `tracking_html_uploaded_at` stamp — the processor must not talk to
   * `AquilineClient` directly, or the guard chain and the persistence rules
   * would have a second, divergent implementation.
   *
   * Fully best-effort: a refused or failed upload leaves the order exactly as
   * it was. It is not a conversion, spends no quota, and touches neither eBay
   * nor `orders.status`.
   */
  private async refreshTrackingHtml(
    order: AmazonOrderRow,
    trackingUrl?: string,
    trackingHtml?: string,
  ): Promise<void> {
    if (!trackingUrl || !trackingHtml) {
      return;
    }
    try {
      await this.trackingConversion.refreshTrackingHtml({
        orderId: order.id,
        trackingUrl,
        trackingHtml,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Order ${order.id}: ship-track HTML refresh skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
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
    // A provider failure still RESOLVES to the pass-through result — the
    // service never throws — but that result is CLASSIFIED, and the block
    // below refuses to push it. Resolving and pushing are two decisions, not
    // one; only the seller's own configuration makes a raw number pushable.
    const conversion = await this.trackingConversion.resolveForOrder({
      orderId: order.id,
      rawNumber: order.amazon_tracking_number || '',
      rawCarrier: order.amazon_tracking_carrier || '',
      trackingUrl,
      trackingHtml,
    });

    // THE RAW AMAZON NUMBER NEVER REACHES eBAY WHEN A CONVERSION WAS EXPECTED.
    //
    // This is the rule the whole feature exists for. A seller pays to keep
    // their supplier hidden; handing the buyer the supplier's own tracking
    // number is the single worst outcome, and eBay's Fulfillment API has NO
    // update endpoint, so it could never be corrected afterwards. An earlier
    // version of this code pushed the raw number once a 12h window expired,
    // on the argument that tracking a buyer can see beats none at all — which
    // traded the product's entire purpose for a shipping-status timeliness the
    // seller never asked us to prioritise. `raw-tracking-never-pushed.guard.spec.ts`
    // locks the reversal.
    //
    // So: hold indefinitely and keep retrying. `mayPushToEbay` is the single
    // place that decision lives — `PASSTHROUGH_NOT_REQUIRED` (the seller chose
    // not to convert this order) still pushes, because there the raw number IS
    // the intended result.
    //
    // The cost is real and deliberate: an order held past eBay's handling time
    // accrues a late-shipment defect, and eventually an Item-Not-Received case.
    // `ORDER_TRACKING_CONVERSION_HELD` raises that as a CRITICAL Action Center
    // item so the seller can fix the cause (usually quota, ship-from address,
    // or an expired Amazon session) rather than discovering it from a case.
    if (!mayPushToEbay(conversion.outcome)) {
      // The window no longer decides whether to give up — nothing gives up. It
      // only decides how HARD to retry: hourly while a transient cause could
      // still clear, then back to the normal shipped cadence so a permanently
      // stuck order is not scraped every hour forever.
      const retryFast = shouldDeferEbayPush({
        retryable: conversion.outcome === ConversionOutcome.PASSTHROUGH_RETRYABLE,
        shippedDetectedAt: order.shipped_detected_at,
        now: new Date(),
        windowHours: DEFERRAL_WINDOW_HOURS,
      });
      this.logger.warn(
        `Order ${order.id}: tracking conversion did not produce a converted number ` +
          `(${conversion.outcome ?? 'unknown'}) — HOLDING the eBay push. The raw Amazon ` +
          `tracking number is never sent when a conversion was expected.`,
      );
      return {
        pushed: false,
        retryAt: retryFast
          ? new Date(Date.now() + DEFERRAL_RETRY_INTERVAL_HOURS * 3_600_000)
          : undefined,
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
