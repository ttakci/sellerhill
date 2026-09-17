// apps/api/src/modules/billing/billing-webhook-processor.ts
//
// Idempotent webhook processor:
//   1. insertWebhook() — append-only log; dedup on (provider, provider_event_id).
//      A repeated delivery of the same event returns the existing row.
//   2. claimWebhook() — atomic UPDATE … WHERE status IN ('received','failed')
//      so only one worker processes a given row.
//   3. Stale-event check — drop events older than BILLING_WEBHOOK_STALE_MINUTES
//      (after logging them to the inbox) so a flood of ancient redeliveries
//      cannot mutate current subscription state.
//   4. Apply the event to billing_subscriptions (upsert by provider_subscription_id).
//   5. markWebhookProcessed() or markWebhookFailed().
//
// Stale-event protection is the second safety layer (idempotency is the
// first): Stripe retries an undelivered event for up to 3 days, and a
// misconfigured endpoint can accumulate a backlog. Without staleness
// protection, processing that backlog would re-apply old state transitions
// (e.g. a stale cancellation could cancel a re-activated subscription).
//
// The processor is a pure orchestrator over the repository — no business
// logic that isn't visible here. Event-type-specific parsing lives in
// stripe-event-applier.ts (pure, unit-tested) so the processor stays small.

import { Injectable, Logger } from '@nestjs/common';
import { BillingWebhookStatus } from '@repo/shared';

import { isStaleEvent, type BillingConfig } from './billing-helpers';
import { BillingRepositoryService } from './billing-repository.service';
import { BillingProvider, type ParsedStripeEvent } from './billing.types';
import { applyStripeEvent, type StripeApplyResult } from './stripe-event-applier';

export interface ProcessResult {
  /** The inbox row id. */
  webhookId: string;
  /** Whether this call actually processed the event (true) or deduped/skipped
   *  it (false). Dedup happens at insert time (same provider_event_id) or at
   *  claim time (another worker owns the row). */
  processed: boolean;
  /** Why the event was skipped, when processed=false. */
  reason?: 'duplicate' | 'already_processing' | 'stale';
  /** The result of applying the event to subscription state, when processed=true. */
  applyResult?: StripeApplyResult;
}

/**
 * The one mail call this processor makes, as its own tiny port. Declared here
 * rather than importing EmailService so the billing module does not depend on
 * the mail module's shape, and so the processor's existing unit tests keep
 * constructing it with two arguments.
 */
export interface BillingNotificationSender {
  sendPaymentFailedEmail(
    email: string,
    firstName: string,
    planName: string,
    locale?: string,
  ): Promise<void>;
}

@Injectable()
export class BillingWebhookProcessor {
  private readonly logger = new Logger(BillingWebhookProcessor.name);

  constructor(
    private readonly repository: BillingRepositoryService,
    private readonly config: BillingConfig,
    /** Optional so the processor stays constructible without the mail stack
     *  (its unit tests do exactly that); a missing service simply sends no
     *  e-mail, it never fails the webhook. */
    private readonly email?: BillingNotificationSender,
  ) {}

  /**
   * Process a Stripe event whose signature the controller has already verified.
   * Safe to call concurrently and on redelivery — see the class doc.
   */
  async process(event: ParsedStripeEvent): Promise<ProcessResult> {
    // 1. Append to inbox (idempotent on provider_event_id).
    const { row, inserted } = await this.repository.insertWebhook(BillingProvider.STRIPE, event);
    if (!inserted && row.status === BillingWebhookStatus.PROCESSED) {
      // Already fully processed by a prior delivery — skip.
      return { webhookId: row.id, processed: false, reason: 'duplicate' };
    }

    // 2. Claim for processing (atomic; prevents concurrent workers racing).
    const claimed = await this.repository.claimWebhook(row.id);
    if (!claimed) {
      // Another worker owns it (status='processing') — let them finish.
      return { webhookId: row.id, processed: false, reason: 'already_processing' };
    }

    // 3. Stale-event protection. Drop ancient events AFTER logging them so
    //    the audit trail is preserved, but BEFORE applying state.
    if (isStaleEvent(event.occurredAt, this.config.webhookStaleMinutes)) {
      this.logger.warn(
        `Dropping stale webhook ${row.id} (event_id=${event.eventId ?? 'none'}, type=${event.eventType}, occurredAt=${event.occurredAt})`,
      );
      await this.repository.markWebhookProcessed(row.id); // not an error — intentional drop
      return { webhookId: row.id, processed: false, reason: 'stale' };
    }

    // 4. Apply the event to subscription state.
    try {
      const applyResult = await applyStripeEvent(this.repository, event);
      await this.repository.markWebhookProcessed(row.id);
      // 5. Tell the seller, for the one event they cannot discover on their
      //    own. Deliberately AFTER the state write and fully swallowed: a mail
      //    failure must never make Stripe redeliver an event we have applied.
      await this.notifyPaymentFailed(event);
      return { webhookId: row.id, processed: true, applyResult };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process webhook ${row.id} (type=${event.eventType}): ${message}`);
      await this.repository.markWebhookFailed(row.id, message, this.config.webhookMaxAttempts);
      // Re-throw so the controller returns a non-200 and Stripe redelivers.
      // The idempotency seam (claim + dedup) keeps redelivery safe.
      throw error;
    }
  }

  /**
   * E-mail the seller that their payment failed and automation has stopped.
   *
   * `invoice.payment_failed` is the right signal: it fires on each failed
   * attempt of Stripe's retry schedule, which is exactly when the seller can
   * still act. Redeliveries of the SAME attempt cannot double-send, because
   * the inbox short-circuits a duplicate event id long before this point.
   *
   * Entirely best-effort. Everything here is a nice-to-have on top of a
   * webhook that has already been applied.
   */
  private async notifyPaymentFailed(event: ParsedStripeEvent): Promise<void> {
    if (event.eventType !== 'invoice.payment_failed' || !this.email) {
      return;
    }
    try {
      const data = (event.payload.data ?? {}) as Record<string, unknown>;
      const invoice = (data.object ?? {}) as Record<string, unknown>;
      const providerCustomerId =
        typeof invoice.customer === 'string' ? invoice.customer : null;
      if (!providerCustomerId) {
        return;
      }
      const contact = await this.repository.findBillingContactByProviderCustomerId(
        BillingProvider.STRIPE,
        providerCustomerId,
      );
      if (!contact) {
        return;
      }
      await this.email.sendPaymentFailedEmail(
        contact.email,
        contact.firstName,
        contact.planName ?? '',
        contact.locale,
      );
      this.logger.log(`Payment-failed e-mail sent to user ${contact.userId}`);
    } catch (err) {
      this.logger.warn(
        `Payment-failed e-mail not sent: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
