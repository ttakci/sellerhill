// apps/api/src/modules/amazon/tracking-webhook.service.ts
//
// Applies one inbound Aquiline webhook to an order.
//
// WHAT THIS IS NOT: a delivery pipeline. The Integration API has NO delivery
// event — its catalog is `tracking.html.*` and `tracking.problem.*` only, which
// the provider confirmed on 2026-08-26. Delivery is still detected by the
// Amazon polling in `AmazonTrackingProcessorService`, and nothing here may stop
// that polling. `tracking-webhook-coverage.guard.spec.ts` locks that rule.
//
// What this DOES is surface conversion health: whether the ship-track HTML we
// upload is being accepted and applied, and whether the provider has opened a
// problem the seller can act on (an expired Amazon session, most importantly).
// Without it, a rejected upload is invisible — the conversion silently falls
// back to the raw Amazon number and the supplier the seller pays to hide is
// exposed, with nothing anywhere saying so.
//
// Everything is idempotent because the provider retries any non-2xx on
// 1s / 5s / 20s and then gives up after four attempts.

import { Injectable, Logger } from '@nestjs/common';
import {
  AquilineProblemCode,
  PlatformSettingKey,
  TrackingConversionProvider,
  type AquilineWebhookPayload,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  decideTrackingProblem,
  isStaleTrackingEvent,
  TrackingProblemTransition,
  TrackingWebhookOutcome,
} from './tracking-webhook.helpers';

interface MatchedOrderRow {
  id: string;
  user_id: string;
  ebay_order_id: string;
  tracking_problem_code: string | null;
}

@Injectable()
export class TrackingWebhookService {
  private readonly logger = new Logger(TrackingWebhookService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Process one verified webhook. Always records an inbox row, always resolves
   * to an outcome, never throws — the caller answers 200 regardless, because a
   * non-2xx buys provider retries of an event we already understood, and the
   * provider only retries four times before dropping it for good.
   */
  async process(payload: AquilineWebhookPayload): Promise<TrackingWebhookOutcome> {
    const maxAge = await this.resolveMaxAgeMinutes();
    if (isStaleTrackingEvent(payload.createdAt, Date.now(), maxAge)) {
      this.logger.warn(
        `Aquiline webhook ${payload.event} for order ${payload.data.orderId} is stale (${payload.createdAt}) — recorded, not applied`,
      );
      await this.record(payload, TrackingWebhookOutcome.STALE, null);
      return TrackingWebhookOutcome.STALE;
    }

    const decision = decideTrackingProblem(payload);
    if (decision.transition === TrackingProblemTransition.NONE) {
      await this.record(payload, TrackingWebhookOutcome.IGNORED, null);
      return TrackingWebhookOutcome.IGNORED;
    }

    const order = await this.findOrder(payload.data.profileId, payload.data.orderId);
    if (!order) {
      // Not necessarily an error: the provider may push for an order created
      // outside SellerHill, or before our own row exists. Recorded so support
      // can see it rather than it vanishing.
      this.logger.warn(
        `Aquiline webhook ${payload.event} for unknown order ${payload.data.orderId} (profile ${payload.data.profileId}) — no match`,
      );
      await this.record(payload, TrackingWebhookOutcome.UNMATCHED, null);
      return TrackingWebhookOutcome.UNMATCHED;
    }

    // Claim BEFORE the side effect. The partial unique index on
    // (provider, profile_id, marketplace_order_id, event_type, occurred_at)
    // WHERE outcome = 'applied' is what makes two concurrent retries safe: the
    // loser's insert fails and it exits without touching the order.
    const claimed = await this.claim(payload, order.id);
    if (!claimed) {
      return TrackingWebhookOutcome.DUPLICATE;
    }

    try {
      await this.applyDecision(order, payload, decision);
      return TrackingWebhookOutcome.APPLIED;
    } catch (err) {
      // Release the claim so a provider retry can legitimately try again.
      await this.releaseClaim(payload, order.id, (err as Error).message);
      this.logger.error(
        `Failed to apply Aquiline webhook ${payload.event} for order ${order.id}: ${(err as Error).message}`,
      );
      return TrackingWebhookOutcome.FAILED;
    }
  }

  /**
   * Write or clear `orders.tracking_problem_code`.
   *
   * An `amazon_session_expired` problem is logged at ERROR rather than warn:
   * it means our stored Amazon session stopped working, so every subsequent
   * ship-track upload for that seller fails and every conversion silently
   * degrades to the raw Amazon number. Nothing else in the flow reports that,
   * and the seller keeps paying for concealment they are no longer getting.
   */
  private async applyDecision(
    order: MatchedOrderRow,
    payload: AquilineWebhookPayload,
    decision: ReturnType<typeof decideTrackingProblem>,
  ): Promise<void> {
    if (decision.transition === TrackingProblemTransition.CLEAR) {
      await this.databaseService.query(
        `UPDATE orders SET tracking_problem_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [order.id],
      );
      this.logger.log(
        `Order ${order.id}: Aquiline cleared its tracking problem (${payload.event})`,
      );
      return;
    }

    await this.databaseService.query(
      `UPDATE orders SET tracking_problem_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [decision.problemCode, order.id],
    );

    if (decision.unknownCode) {
      // Recorded, stored as NULL, and flagged — the seller-facing renderer has
      // no key for a code we have never seen, and inventing one would show
      // them a raw provider string.
      this.logger.warn(
        `Order ${order.id}: Aquiline reported an UNKNOWN problem code "${payload.data.problemCode ?? ''}" (${payload.event}) — stored as null; add it to AquilineProblemCode if it recurs`,
      );
      return;
    }

    if (decision.problemCode === AquilineProblemCode.AMAZON_SESSION_EXPIRED) {
      this.logger.error(
        `Order ${order.id}: Aquiline reports the Amazon session expired — every ship-track upload for this seller now fails and their conversions silently fall back to the raw Amazon number`,
      );
      return;
    }

    this.logger.warn(
      `Order ${order.id}: Aquiline opened tracking problem ${decision.problemCode ?? 'unknown'} (${payload.event})`,
    );
  }

  /**
   * Find the order a webhook refers to.
   *
   * Keyed on `(profileId, amazon_order_id)`, NOT on a tracking number — the
   * provider confirmed the AQUA number is never in a webhook payload. The
   * profile id is `{prefix}-{userId}-{marketplace}`, so joining through
   * `aquiline_profiles` scopes the match to the right seller: two sellers can
   * legitimately hold the same Amazon order id, and matching on the order id
   * alone would let one seller's problem be written onto another's order.
   */
  private async findOrder(
    profileId: string,
    marketplaceOrderId: string,
  ): Promise<MatchedOrderRow | null> {
    const rows = await this.databaseService.query<MatchedOrderRow>(
      `SELECT o.id, o.user_id, o.ebay_order_id, o.tracking_problem_code
         FROM orders o
         JOIN aquiline_profiles p ON p.user_id = o.user_id
        WHERE p.profile_id = $1
          AND o.amazon_order_id = $2
        LIMIT 1`,
      [profileId, marketplaceOrderId],
    );
    return rows[0] ?? null;
  }

  /** Insert the 'applied' inbox row. False when another delivery won the race. */
  private async claim(payload: AquilineWebhookPayload, orderId: string): Promise<boolean> {
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        `INSERT INTO tracking_webhook_events
           (provider, event_type, profile_id, marketplace_order_id, occurred_at,
            problem_code, outcome_detail, outcome, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'applied', $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          TrackingConversionProvider.AQUILINE,
          payload.event,
          payload.data.profileId,
          payload.data.orderId,
          payload.createdAt,
          payload.data.problemCode ?? payload.data.previousProblemCode ?? null,
          payload.data.outcome ?? null,
          orderId,
        ],
      );
      return rows.length > 0;
    } catch (err) {
      this.logger.error(`Could not claim Aquiline webhook: ${(err as Error).message}`);
      return false;
    }
  }

  /** Demote a failed claim so the provider's retry is not treated as a duplicate. */
  private async releaseClaim(
    payload: AquilineWebhookPayload,
    orderId: string,
    error: string,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `UPDATE tracking_webhook_events
            SET outcome = 'failed', error = $1
          WHERE provider = $2 AND profile_id = $3 AND marketplace_order_id = $4
            AND event_type = $5 AND occurred_at = $6 AND outcome = 'applied'
            AND order_id = $7`,
        [
          error.slice(0, 500),
          TrackingConversionProvider.AQUILINE,
          payload.data.profileId,
          payload.data.orderId,
          payload.event,
          payload.createdAt,
          orderId,
        ],
      );
    } catch (err) {
      this.logger.error(`Could not release Aquiline webhook claim: ${(err as Error).message}`);
    }
  }

  /** Append-only audit row for a non-applied outcome. Never throws. */
  private async record(
    payload: AquilineWebhookPayload,
    outcome: TrackingWebhookOutcome,
    orderId: string | null,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO tracking_webhook_events
           (provider, event_type, profile_id, marketplace_order_id, occurred_at,
            problem_code, outcome_detail, outcome, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          TrackingConversionProvider.AQUILINE,
          payload.event,
          payload.data.profileId,
          payload.data.orderId,
          payload.createdAt,
          payload.data.problemCode ?? payload.data.previousProblemCode ?? null,
          payload.data.outcome ?? null,
          outcome,
          orderId,
        ],
      );
    } catch (err) {
      this.logger.warn(`Could not record Aquiline webhook (${outcome}): ${(err as Error).message}`);
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
