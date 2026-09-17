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

import type { BillingRepositoryService } from './billing-repository.service';
import { type ParsedStripeEvent } from './billing.types';
import { extractStripeSubscriptionFields } from './stripe-event-applier';

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

/**
 * Write a raw Stripe subscription onto a local customer, exactly as the
 * webhook would: the one shared mapper, the one repository writer, then close
 * any local trial rows.
 *
 * Used by the two paths that do NOT come from a webhook — the checkout return
 * page and the hourly reconcile — so a subscription that exists in Stripe is
 * never missing locally just because its webhook was lost. Returns false,
 * writing nothing, for a status this system does not track or a subscription
 * with no plan_id metadata (created outside our checkout).
 */
export async function applyProviderSubscription(
  repository: Pick<
    BillingRepositoryService,
    'upsertSubscriptionByProvider' | 'endTrialSubscriptionsForUser'
  >,
  customer: { id: string; userId: string | null },
  subscription: unknown,
): Promise<boolean> {
  const fields = extractStripeSubscriptionFields(buildReconcileEvent(subscription));
  if (!fields) {
    return false;
  }
  const planId = resolveReconcilePlanId(subscription);
  if (!planId) {
    return false;
  }
  // Subscription FIRST, trial close second — the order the operator CLI uses,
  // and for the same reason: if the trial close ran first and the upsert then
  // failed, the account would be left with an ended trial and no subscription,
  // i.e. suspended by the very path meant to un-suspend it.
  const row = await repository.upsertSubscriptionByProvider(customer.id, planId, fields);
  if (!row) {
    return false;
  }
  if (customer.userId) {
    try {
      await repository.endTrialSubscriptionsForUser(customer.userId);
    } catch {
      // Best-effort: a provider-backed row already outranks a trial row in
      // findCurrentSubscription, so a lingering trial cannot mask the payment.
    }
  }
  return true;
}
