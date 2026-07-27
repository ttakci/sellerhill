// apps/api/src/modules/billing/paddle-event-applier.ts
//
// Apply a parsed Paddle webhook event to subscription state. The pure
// extraction (`extractSubscriptionFields`) is unit-tested; the impure
// `applyPaddleEvent` orchestrates repository calls around it.
//
// Paddle event reference:
//   https://developer.paddle.com/webhooks/overview/events
//
// Phase 2 handles the subscription lifecycle events:
//   - subscription.created   → upsert an active/trialing subscription
//   - subscription.activated → upsert an active subscription
//   - subscription.updated    → upsert with new period/status
//   - subscription.canceled   → upsert with status=canceled, canceled_at
//   - subscription.past_due  → upsert with status=past_due
//
// Unknown event types are logged and ignored (the inbox row is still marked
// processed — ignoring an unknown type is a deliberate no-op, not a failure).

import { BillingInterval, BillingSubscriptionStatus, type BillingSubscriptionDto } from '@repo/shared';

import type { BillingRepositoryService } from './billing-repository.service';
import type { ParsedPaddleEvent } from './billing.types';

export interface SubscriptionFields {
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  endedAt: Date | null;
  metadata: Record<string, unknown>;
}

export type ApplyResult =
  | { kind: 'upserted'; subscription: BillingSubscriptionDto | null }
  | { kind: 'ignored'; reason: 'unknown_event_type' | 'no_subscription_data' | 'no_customer' | 'no_plan' };

/**
 * Pure extraction of subscription fields from a Paddle event payload. Returns
 * null when the event type is not a subscription lifecycle event we handle, or
 * when the payload is missing the subscription object.
 */
export function extractSubscriptionFields(event: ParsedPaddleEvent): SubscriptionFields | null {
  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const subRaw = data.subscription ?? data;
  if (!subRaw || typeof subRaw !== 'object') {return null;}
  const sub = subRaw as Record<string, unknown>;

  const providerSubscriptionId = typeof sub.id === 'string' ? sub.id : null;
  if (!providerSubscriptionId) {return null;}

  const status = mapStatus(event.eventType);
  if (status === null) {return null;} // unknown event type

  const interval = mapInterval(sub);
  const periodStart = parseDate(sub.started_at ?? getField(sub.current_billing_period, 'starts_at'));
  const periodEnd = parseDate(sub.ended_at ?? getField(sub.current_billing_period, 'ends_at'));
  // Default to a 1-month window if period dates are missing — the schema
  // requires non-null period boundaries. A real Paddle event always carries
  // them; this is a defensive fallback.
  const now = new Date();
  const start = periodStart ?? now;
  const end = periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const canceledAt = status === BillingSubscriptionStatus.CANCELED ? parseDate(sub.canceled_at) ?? now : null;
  const endedAt = status === BillingSubscriptionStatus.ENDED ? parseDate(sub.ended_at) ?? now : null;

  return {
    providerSubscriptionId,
    status,
    interval,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    canceledAt,
    endedAt,
    metadata: {
      paddle_event_id: event.eventId,
      paddle_event_type: event.eventType,
      occurred_at: event.occurredAt,
      raw_status: typeof sub.status === 'string' ? sub.status : null,
    },
  };
}

function mapStatus(eventType: string): BillingSubscriptionStatus | null {
  switch (eventType) {
    case 'subscription.created':
      return BillingSubscriptionStatus.TRIALING;
    case 'subscription.activated':
      return BillingSubscriptionStatus.ACTIVE;
    case 'subscription.updated':
      return BillingSubscriptionStatus.ACTIVE;
    case 'subscription.canceled':
      return BillingSubscriptionStatus.CANCELED;
    case 'subscription.past_due':
      return BillingSubscriptionStatus.PAST_DUE;
    default:
      return null;
  }
}

function mapInterval(sub: Record<string, unknown>): BillingInterval {
  const bp = sub.billing_period;
  const raw = typeof getField(bp, 'interval') === 'string'
    ? (bp as Record<string, unknown>).interval
    : typeof sub.interval === 'string'
      ? sub.interval
      : null;
  if (raw === 'year' || raw === 'annual') {return BillingInterval.ANNUAL;}
  return BillingInterval.MONTHLY;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') {return null;}
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Safely read a key from a value that may be an object or null/undefined.
 * Returns undefined for non-object input. Used to navigate Paddle's nested
 * payloads without TS narrowing away the property access.
 */
function getField(maybeObj: unknown, key: string): unknown {
  if (maybeObj && typeof maybeObj === 'object') {
    return (maybeObj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Apply a parsed Paddle event to subscription state. Looks up the customer +
 * plan, then upserts the subscription row. Returns `ignored` when the event
 * type is unknown, the payload has no subscription data, the customer is not
 * linked to a user, or the plan referenced by the subscription is not found
 * (the operator must mirror plans to Paddle with the same plan slug/id).
 */
export async function applyPaddleEvent(
  repository: BillingRepositoryService,
  event: ParsedPaddleEvent,
): Promise<ApplyResult> {
  const fields = extractSubscriptionFields(event);
  if (!fields) {
    return { kind: 'ignored', reason: 'unknown_event_type' };
  }

  // Resolve the customer from the Paddle customer id in the payload.
  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const subRaw = data.subscription ?? data;
  const sub = (subRaw && typeof subRaw === 'object' ? subRaw : {}) as Record<string, unknown>;
  const providerCustomerId = typeof sub.customer_id === 'string' ? sub.customer_id : null;
  if (!providerCustomerId) {
    return { kind: 'ignored', reason: 'no_customer' };
  }
  const customer = await repository.findCustomerByProviderId('paddle', providerCustomerId);
  if (!customer) {
    // The customer hasn't been linked yet — this happens when the first
    // checkout webhook arrives before our checkout flow created the local
    // customer row. The inbox row is still marked processed (idempotent), and
    // a later event for the same subscription will succeed once the customer
    // is linked. We do NOT auto-create a customer here — that would orphans
    // the row from the user_id.
    return { kind: 'ignored', reason: 'no_customer' };
  }

  // Resolve the plan from the items[].price.product_id or a metadata slug.
  // Phase 1: plans are seeded by slug; the Paddle product id is stored on
  // billing_plans.provider_product_id. The subscription event carries price
  // ids, not product ids, so we look up by the provider_product_id stored on
  // each plan. For phase 2 we accept a best-effort match: if the event
  // carries a `plan_id` (our internal UUID) in metadata, use it; otherwise
  // fall back to the first active plan (operator wires plan↔Paddle-product
  // mapping manually). This is intentionally lax for phase 2 — strict
  // matching is a phase-3 concern once plans are mirrored to Paddle.
  const planId = resolvePlanId(event);
  if (!planId) {
    return { kind: 'ignored', reason: 'no_plan' };
  }

  const subscription = await repository.upsertSubscriptionByProvider(customer.id, planId, fields);
  return { kind: 'upserted', subscription };
}

/**
 * Resolve the internal plan id from a Paddle event. Phase 2 strategy:
 *  1. If the event payload carries `plan_id` (our UUID) in `data.metadata`,
 *     use it directly.
 *  2. Otherwise, if it carries `plan_slug` (our slug), the caller (repository)
 *     can look it up — but for phase 2 we only support the metadata path and
 *     the fallback below.
 *  3. Fallback: return null and let the applier return `ignored`. This is the
 *     honest state until plans are mirrored to Paddle with provider_product_id.
 */
function resolvePlanId(event: ParsedPaddleEvent): string | null {
  const data = (event.payload.data ?? {}) as Record<string, unknown>;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.plan_id === 'string') {return meta.plan_id;}
  // The webhook inbox stores the full payload; the checkout flow should
  // stamp `metadata.plan_id` on the Paddle transaction so it round-trips.
  return null;
}
