// apps/api/src/modules/amazon/tracking-webhook.service.ts
//
// Applies an inbound tracking-provider webhook to an order.
//
// This is the half that replaces Playwright polling for delivery detection:
// before it existed, "has this been delivered?" was answered by scraping the
// Amazon order page every 24h for the whole post-shipment week. Now the
// provider pushes `shipment.delivered` and we act on it immediately — the
// order completes sooner AND costs no browser time.
//
// Everything here is idempotent because the provider retries any non-2xx on
// 1s/5s/20s. Applying a delivery twice would re-enqueue the buyer's
// "delivered" message and a second feedback request.

import { Injectable, Logger } from '@nestjs/common';
import {
  BuyerMessageEventType,
  OrderStatus,
  PlatformSettingKey,
  TrackingConversionProvider,
  type TrackingWebhookPayload,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';

import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import {
  isSignificantChange,
  isStaleTrackingEvent,
  resolveWebhookOrderStatus,
  TrackingWebhookOutcome,
} from './tracking-webhook.helpers';

interface MatchedOrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  ebay_order_id: string;
  status: OrderStatus;
  amazon_account_id: string | null;
}

@Injectable()
export class TrackingWebhookService {
  private readonly logger = new Logger(TrackingWebhookService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly buyerMessages: BuyerMessageQueueService,
    private readonly trackingQueue: AmazonTrackingQueueService,
  ) {}

  /**
   * Process one verified webhook. Always records an inbox row, always resolves
   * to an outcome, never throws — the caller answers 200 regardless, because a
   * non-2xx buys three provider retries of an event we already understood.
   */
  async process(payload: TrackingWebhookPayload): Promise<TrackingWebhookOutcome> {
    const trackingNumber = payload.data.trackingNumber;

    if (!isSignificantChange(payload)) {
      await this.record(payload, TrackingWebhookOutcome.IGNORED, null);
      return TrackingWebhookOutcome.IGNORED;
    }

    const maxAge = await this.resolveMaxAgeMinutes();
    if (isStaleTrackingEvent(payload.occurredAt, Date.now(), maxAge)) {
      this.logger.warn(`Tracking webhook for ${trackingNumber} is stale (${payload.occurredAt}) — recorded, not applied`);
      await this.record(payload, TrackingWebhookOutcome.STALE, null);
      return TrackingWebhookOutcome.STALE;
    }

    const order = await this.findOrder(trackingNumber);
    if (!order) {
      // Not necessarily an error: the provider may push for a number issued
      // outside SellerHill, or before our row was written. Recorded so support can
      // see it rather than it vanishing.
      this.logger.warn(`Tracking webhook for unknown number ${trackingNumber} — no matching order`);
      await this.record(payload, TrackingWebhookOutcome.UNMATCHED, null);
      return TrackingWebhookOutcome.UNMATCHED;
    }

    const nextStatus = resolveWebhookOrderStatus(payload);
    if (nextStatus === null) {
      await this.record(payload, TrackingWebhookOutcome.IGNORED, order.id);
      return TrackingWebhookOutcome.IGNORED;
    }

    // Terminal states are sticky. A late `delivered` for an order already
    // completed (or cancelled on our side) must not re-run its side effects.
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      await this.record(payload, TrackingWebhookOutcome.DUPLICATE, order.id);
      return TrackingWebhookOutcome.DUPLICATE;
    }

    // Claim the event BEFORE side effects. The partial unique index on
    // (provider, tracking_number, event_type, occurred_at) WHERE outcome =
    // 'applied' is what makes two concurrent retries safe: the loser's insert
    // fails and it exits without touching the order.
    const claimed = await this.claim(payload, order.id);
    if (!claimed) {
      return TrackingWebhookOutcome.DUPLICATE;
    }

    try {
      await this.applyDelivered(order);
      return TrackingWebhookOutcome.APPLIED;
    } catch (err) {
      // Release the claim so a provider retry can legitimately try again.
      await this.releaseClaim(payload, order.id, (err as Error).message);
      this.logger.error(
        `Failed to apply delivery for order ${order.id} (${trackingNumber}): ${(err as Error).message}`,
      );
      return TrackingWebhookOutcome.FAILED;
    }
  }

  /**
   * The delivered transition, mirroring the Amazon-poller path so the two
   * cannot drift: complete the order, tell the buyer, schedule the feedback
   * request, and stop any per-order Amazon polling still running.
   *
   * `handleShipped` is deliberately NOT called here. A conversion only exists
   * because the order already reached SHIPPED, so eBay has its fulfilment.
   */
  private async applyDelivered(order: MatchedOrderRow): Promise<void> {
    await this.databaseService.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [OrderStatus.COMPLETED, order.id],
    );

    await this.enqueueBuyerMessage(order, BuyerMessageEventType.DELIVERED);
    const delayDays = await this.platformSettings.getNumber(
      PlatformSettingKey.BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS,
    );
    await this.enqueueBuyerMessage(order, BuyerMessageEventType.FEEDBACK_REQUEST, {
      delayMs: delayDays * 86_400_000,
    });

    // The order is terminal; a per-order Amazon scheduler would otherwise keep
    // scraping until its own next tick noticed.
    await this.trackingQueue.removeOrderTracking(order.id).catch((err: unknown) => {
      this.logger.warn(
        `Order ${order.id} completed by webhook but its tracking scheduler could not be removed: ${(err as Error).message}`,
      );
    });

    this.logger.log(`Order ${order.id} marked delivered from provider webhook`);
  }

  /** Buyer messaging is best-effort: it must never fail a delivery. */
  private async enqueueBuyerMessage(
    order: MatchedOrderRow,
    event: BuyerMessageEventType,
    options?: { delayMs?: number },
  ): Promise<void> {
    try {
      await this.buyerMessages.enqueue(
        {
          ebayOrderId: order.ebay_order_id,
          userId: order.user_id,
          ebayAccountId: order.ebay_account_id,
          storeId: null,
          event,
        },
        options,
      );
    } catch (err) {
      this.logger.warn(
        `Buyer message ${event} for order ${order.id} could not be enqueued: ${(err as Error).message}`,
      );
    }
  }

  private async findOrder(trackingNumber: string): Promise<MatchedOrderRow | null> {
    const rows = await this.databaseService.query<MatchedOrderRow>(
      `SELECT id, user_id, ebay_account_id, ebay_order_id, status, amazon_account_id
       FROM orders WHERE converted_tracking_number = $1`,
      [trackingNumber],
    );
    return rows[0] ?? null;
  }

  /** Insert the 'applied' inbox row. False when another delivery won the race. */
  private async claim(payload: TrackingWebhookPayload, orderId: string): Promise<boolean> {
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        `INSERT INTO tracking_webhook_events
           (provider, event_type, tracking_number, occurred_at, status, change_type, outcome, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'applied', $7)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          TrackingConversionProvider.AQUILINE,
          payload.type,
          payload.data.trackingNumber,
          payload.occurredAt,
          payload.data.status ?? null,
          payload.data.changeType ?? null,
          orderId,
        ],
      );
      return rows.length > 0;
    } catch (err) {
      this.logger.error(`Could not claim tracking webhook: ${(err as Error).message}`);
      return false;
    }
  }

  /** Demote a failed claim so the provider's retry is not treated as a duplicate. */
  private async releaseClaim(
    payload: TrackingWebhookPayload,
    orderId: string,
    error: string,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `UPDATE tracking_webhook_events
            SET outcome = 'failed', error = $1
          WHERE provider = $2 AND tracking_number = $3 AND event_type = $4
            AND occurred_at = $5 AND outcome = 'applied' AND order_id = $6`,
        [
          error.slice(0, 500),
          TrackingConversionProvider.AQUILINE,
          payload.data.trackingNumber,
          payload.type,
          payload.occurredAt,
          orderId,
        ],
      );
    } catch (err) {
      this.logger.error(`Could not release tracking webhook claim: ${(err as Error).message}`);
    }
  }

  /** Append-only audit row for a non-applied outcome. Never throws. */
  private async record(
    payload: TrackingWebhookPayload,
    outcome: TrackingWebhookOutcome,
    orderId: string | null,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO tracking_webhook_events
           (provider, event_type, tracking_number, occurred_at, status, change_type, outcome, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          TrackingConversionProvider.AQUILINE,
          payload.type,
          payload.data.trackingNumber,
          payload.occurredAt,
          payload.data.status ?? null,
          payload.data.changeType ?? null,
          outcome,
          orderId,
        ],
      );
    } catch (err) {
      this.logger.warn(`Could not record tracking webhook (${outcome}): ${(err as Error).message}`);
    }
  }

  private async resolveMaxAgeMinutes(): Promise<number> {
    try {
      const value = await this.platformSettings.getNumber(
        PlatformSettingKey.AQUILINE_WEBHOOK_MAX_AGE_MINUTES,
      );
      return Number.isFinite(value) && value > 0 ? value : 1440;
    } catch {
      return 1440;
    }
  }
}
