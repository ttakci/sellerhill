// apps/api/src/modules/billing/subscription-reconcile.ts
//
// Shared, pure pieces of "re-read a subscription from Stripe and re-apply it".
//
// Two callers need them and must not drift: the operator CLI
// (`scripts/billing-reconcile.ts`) and the periodic job
// (`subscription-reconcile.processor.ts`). Both feed the SAME mapper the
// webhook uses (`extractStripeSubscriptionFields`) and the SAME repository
// writer, so a reconciled row is byte-for-byte what a webhook would have
// written.

import { type ParsedStripeEvent } from './billing.types';

/**
 * The synthetic envelope's event type. Must be one
 * `extractStripeSubscriptionFields` accepts (its `SUBSCRIPTION_EVENT_TYPES`
 * set) — the mapper reads Stripe's own `status` off the object regardless of
 * which of the three it is, so `updated` is the honest label for "we re-read
 * the current state".
 */
export const RECONCILE_EVENT_TYPE = 'customer.subscription.updated';

/**
 * Wrap a Stripe subscription object in the same `ParsedStripeEvent` shape the
 * webhook controller produces, so the one shared mapper can be reused verbatim.
 * `eventId` is not a real `evt_...`; it lands in the persisted
 * `metadata.stripe_event_id`, where the `reconcile:` prefix is a deliberate
 * breadcrumb that the row was written by a reconcile, not a webhook. `now` is
 * injectable so the envelope is deterministic under test.
 */
export function buildReconcileEvent(subscription: unknown, now: Date = new Date()): ParsedStripeEvent {
  const iso = now.toISOString();
  return {
    eventId: `reconcile:${iso}`,
    eventType: RECONCILE_EVENT_TYPE,
    occurredAt: iso,
    payload: { data: { object: subscription } },
  };
}

/**
 * Pull the internal plan id from a Stripe subscription's own metadata, matching
 * `stripe-event-applier`'s private `resolvePlanId` exactly: a non-empty string
 * at `metadata.plan_id`, or null.
 */
export function resolveReconcilePlanId(subscription: unknown): string | null {
  if (!subscription || typeof subscription !== 'object') {
    return null;
  }
  const meta = ((subscription as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>;
  return typeof meta.plan_id === 'string' && meta.plan_id.length > 0 ? meta.plan_id : null;
}
