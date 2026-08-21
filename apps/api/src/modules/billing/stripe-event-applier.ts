// apps/api/src/modules/billing/stripe-event-applier.ts
//
// Apply a parsed Stripe webhook event to subscription state. The pure
// extraction (`extractStripeSubscriptionFields`) is unit-tested; the impure
// `applyStripeEvent` orchestrates repository calls around it.
//
// Stripe event reference: https://docs.stripe.com/api/events/types
//
// Only `customer.subscription.created|updated|deleted` mutate state. Stripe's
// own `status` field on the subscription object is authoritative regardless of
// which of the three fired, so status is read from the object rather than
// inferred from the event type.
//
// Deliberately NOT handled:
//   - `checkout.session.completed` — nothing left to do. The Stripe customer is
//     created and linked when the checkout session is created (see
//     StripeBillingProvider.ensureStripeCustomer), so the local customer row is
//     already resolvable by the time any webhook arrives. Depending on this
//     event instead would make correctness depend on webhook delivery order.
//   - `invoice.paid` / `invoice.payment_failed` — the subscription status
//     transitions they imply (e.g. past_due) already arrive via
//     `customer.subscription.updated`. They are still recorded in the webhook
//     inbox, so the audit trail is complete and dunning/receipt logic can be
//     added later without changing the transport.

import { BillingInterval, BillingSubscriptionStatus, type BillingSubscriptionDto } from '@repo/shared';

import type { BillingRepositoryService } from './billing-repository.service';
import { BillingProvider, type ParsedStripeEvent } from './billing.types';

export interface StripeSubscriptionFields {
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  endedAt: Date | null;
  metadata: Record<string, unknown>;
}

export type StripeApplyResult =
  | { kind: 'upserted'; subscription: BillingSubscriptionDto | null }
  /** A one-time top-up purchase granted quota. No subscription is involved. */
  | { kind: 'credited'; limitKey: string; quantity: number }
  | {
      kind: 'ignored';
      reason:
        | 'unknown_event_type'
        | 'no_customer'
        | 'no_plan'
        // Top-up path. Each of these is an ordinary outcome, not a fault: a
        // subscription checkout completing, a session still settling, a
        // purchase made outside our flow, a retired pack, or a redelivery.
        | 'not_a_topup'
        | 'not_paid'
        | 'no_addon_metadata'
        | 'unknown_addon'
        | 'already_granted';
    };

const SUBSCRIPTION_EVENT_TYPES = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Pure extraction of subscription fields from a Stripe event payload. Returns
 * null when the event type is not one of the three subscription lifecycle
 * events handled here, or the payload has no usable subscription object.
 */
export function extractStripeSubscriptionFields(event: ParsedStripeEvent): StripeSubscriptionFields | null {
  if (!SUBSCRIPTION_EVENT_TYPES.has(event.eventType)) {return null;}

  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const subRaw = data.object;
  if (!subRaw || typeof subRaw !== 'object') {return null;}
  const sub = subRaw as Record<string, unknown>;

  const providerSubscriptionId = typeof sub.id === 'string' ? sub.id : null;
  if (!providerSubscriptionId) {return null;}

  const status = mapStatus(sub.status);
  if (status === null) {return null;} // incomplete / paused — not a state we track

  const interval = mapInterval(sub);
  const start = parseUnixSeconds(sub.current_period_start) ?? new Date();
  const end = parseUnixSeconds(sub.current_period_end) ?? new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const canceledAt = status === BillingSubscriptionStatus.CANCELED ? parseUnixSeconds(sub.canceled_at) ?? new Date() : null;
  const endedAt = status === BillingSubscriptionStatus.ENDED ? parseUnixSeconds(sub.ended_at) ?? new Date() : null;

  return {
    providerSubscriptionId,
    status,
    interval,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    canceledAt,
    endedAt,
    metadata: {
      stripe_event_id: event.eventId,
      stripe_event_type: event.eventType,
      occurred_at: event.occurredAt,
      raw_status: typeof sub.status === 'string' ? sub.status : null,
    },
  };
}

function mapStatus(rawStatus: unknown): BillingSubscriptionStatus | null {
  switch (rawStatus) {
    case 'trialing':
      return BillingSubscriptionStatus.TRIALING;
    case 'active':
      return BillingSubscriptionStatus.ACTIVE;
    case 'past_due':
    case 'unpaid':
      return BillingSubscriptionStatus.PAST_DUE;
    case 'canceled':
      return BillingSubscriptionStatus.CANCELED;
    case 'incomplete_expired':
      return BillingSubscriptionStatus.ENDED;
    default:
      // 'incomplete' (first payment never completed) and 'paused' have no
      // local equivalent — ignored rather than guessed at.
      return null;
  }
}

function mapInterval(sub: Record<string, unknown>): BillingInterval {
  const items = sub.items as Record<string, unknown> | undefined;
  const list = items && typeof items === 'object' ? (items.data as unknown[] | undefined) : undefined;
  const first = Array.isArray(list) && list.length > 0 ? (list[0] as Record<string, unknown>) : undefined;
  const price = first?.price as Record<string, unknown> | undefined;
  const recurring = price?.recurring as Record<string, unknown> | undefined;
  return recurring?.interval === 'year' ? BillingInterval.ANNUAL : BillingInterval.MONTHLY;
}

function parseUnixSeconds(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {return null;}
  return new Date(value * 1000);
}

/**
 * Apply a parsed Stripe event to subscription state. Anything outside the
 * three subscription lifecycle events is a deliberate no-op (see file header);
 * the inbox row is still marked processed, since ignoring an event we do not
 * act on is not a failure.
 */
export async function applyStripeEvent(
  repository: BillingRepositoryService,
  event: ParsedStripeEvent,
): Promise<StripeApplyResult> {
  // A completed one-time checkout is a quota top-up. It is handled BEFORE the
  // subscription path because it has no subscription at all — this event is the
  // only signal such a purchase ever produces.
  //
  // Note this is the one `checkout.session.completed` we act on. Subscription
  // checkouts deliberately ignore it (the customer is linked before checkout
  // opens, so there is nothing left to do), and that stays true: the branch
  // below returns early only for `mode: 'payment'`.
  if (event.eventType === 'checkout.session.completed') {
    return applyAddonPurchase(repository, event);
  }

  const fields = extractStripeSubscriptionFields(event);
  if (!fields) {
    return { kind: 'ignored', reason: 'unknown_event_type' };
  }

  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const sub = (data.object ?? {}) as Record<string, unknown>;
  const providerCustomerId = typeof sub.customer === 'string' ? sub.customer : null;
  if (!providerCustomerId) {
    return { kind: 'ignored', reason: 'no_customer' };
  }

  const customer = await repository.findCustomerByProviderId(BillingProvider.STRIPE, providerCustomerId);
  if (!customer) {
    // Should not happen: the customer is linked before checkout opens, so any
    // subscription Stripe reports back is for a customer we already know. A
    // miss means the subscription was created outside our checkout flow (e.g.
    // by hand in the Dashboard) — there is no user to attribute it to, so it
    // is recorded in the inbox and ignored rather than guessed at.
    return { kind: 'ignored', reason: 'no_customer' };
  }

  const planId = resolvePlanId(sub);
  if (!planId) {
    return { kind: 'ignored', reason: 'no_plan' };
  }

  const subscription = await repository.upsertSubscriptionByProvider(customer.id, planId, fields);
  return { kind: 'upserted', subscription };
}

/**
 * Resolve the internal plan id from a Stripe subscription's own metadata.
 * StripeBillingProvider.createCheckout stamps `subscription_data.metadata.plan_id`
 * on the Checkout Session, which Stripe copies onto the resulting Subscription
 * object — so every subscription created through our checkout carries it.
 */
function resolvePlanId(sub: Record<string, unknown>): string | null {
  const meta = (sub.metadata ?? {}) as Record<string, unknown>;
  return typeof meta.plan_id === 'string' ? meta.plan_id : null;
}

/**
 * Grant the quota a completed one-time checkout paid for.
 *
 * Every "ignore" below is a real case that must not throw: a subscription
 * checkout completing (nothing to do), a session created outside our flow, or
 * a slug that no longer resolves. Throwing would make Stripe redeliver forever
 * against an event we can never apply.
 */
async function applyAddonPurchase(
  repository: BillingRepositoryService,
  event: ParsedStripeEvent,
): Promise<StripeApplyResult> {
  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const session = (data.object ?? {}) as Record<string, unknown>;

  // Subscription checkouts also emit this event and are already fully handled
  // by customer.subscription.* — see the note at the call site.
  if (session.mode !== 'payment') {
    return { kind: 'ignored', reason: 'not_a_topup' };
  }
  // An unpaid session grants nothing. Checkout can complete with payment still
  // processing (some payment methods settle asynchronously), and granting on
  // the promise rather than the payment gives away allowance for free.
  if (session.payment_status !== 'paid') {
    return { kind: 'ignored', reason: 'not_paid' };
  }

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const addonSlug = typeof metadata.addon_slug === 'string' ? metadata.addon_slug : null;
  const userId =
    typeof session.client_reference_id === 'string'
      ? session.client_reference_id
      : typeof metadata.user_id === 'string'
        ? metadata.user_id
        : null;
  if (!addonSlug || !userId) {
    return { kind: 'ignored', reason: 'no_addon_metadata' };
  }

  const addon = await repository.findQuotaAddonBySlug(addonSlug);
  if (!addon) {
    return { kind: 'ignored', reason: 'unknown_addon' };
  }

  const granted = await repository.grantQuotaCredit({
    userId,
    limitKey: addon.limitKey,
    quantity: addon.quantity,
    addonId: addon.id,
    // The event id is the idempotency key. Falling back to the session id when
    // Stripe omits it keeps the UNIQUE constraint meaningful — a NULL key would
    // let the same purchase grant twice.
    providerEventId: event.eventId ?? `session:${String(session.id ?? '')}`,
    amountMicros: typeof session.amount_total === 'number' ? session.amount_total * 10_000 : null,
    currency: typeof session.currency === 'string' ? session.currency.toUpperCase() : null,
  });

  return granted
    ? { kind: 'credited', limitKey: addon.limitKey, quantity: addon.quantity }
    : { kind: 'ignored', reason: 'already_granted' };
}
