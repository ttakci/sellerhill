// apps/api/src/modules/billing/stripe-event-applier.spec.ts
//
// Pure tests for extractStripeSubscriptionFields — the extraction logic that
// turns a Stripe webhook event into DB-shaped subscription fields. The impure
// applyStripeEvent (which calls the repository) is not tested here; it is an
// orchestrator over repository methods that are themselves DB-backed.

import { BillingInterval, BillingSubscriptionStatus } from '@repo/shared';

import type { ParsedStripeEvent } from './billing.types';
import { extractStripeSubscriptionFields } from './stripe-event-applier';

function makeEvent(object: Record<string, unknown>, eventType = 'customer.subscription.updated'): ParsedStripeEvent {
  return {
    eventId: 'evt_1',
    eventType,
    occurredAt: '2026-07-27T10:00:00Z',
    payload: { data: { object } },
  };
}

describe('extractStripeSubscriptionFields', () => {
  it('returns null for an event type that is not a subscription lifecycle event', () => {
    expect(extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'active' }, 'invoice.paid'))).toBeNull();
  });

  it('returns null when the subscription object has no id', () => {
    expect(extractStripeSubscriptionFields(makeEvent({ status: 'active' }))).toBeNull();
  });

  it('returns null for an untracked status (incomplete)', () => {
    expect(extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'incomplete' }))).toBeNull();
  });

  it('maps status=trialing → trialing, on customer.subscription.created', () => {
    const fields = extractStripeSubscriptionFields(
      makeEvent(
        { id: 'sub_1', status: 'trialing', current_period_start: 1753776000, current_period_end: 1756368000 },
        'customer.subscription.created',
      ),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.TRIALING);
    expect(fields?.providerSubscriptionId).toBe('sub_1');
    expect(fields?.canceledAt).toBeNull();
    expect(fields?.endedAt).toBeNull();
  });

  it('maps status=active → active', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'active' }));
    expect(fields?.status).toBe(BillingSubscriptionStatus.ACTIVE);
  });

  it('maps status=past_due → past_due', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'past_due' }));
    expect(fields?.status).toBe(BillingSubscriptionStatus.PAST_DUE);
  });

  it('maps status=unpaid → past_due', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'unpaid' }));
    expect(fields?.status).toBe(BillingSubscriptionStatus.PAST_DUE);
  });

  it('maps status=incomplete_expired → ended', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'incomplete_expired', ended_at: 1753776000 }));
    expect(fields?.status).toBe(BillingSubscriptionStatus.ENDED);
    expect(fields?.endedAt).toEqual(new Date(1753776000 * 1000));
  });

  it('maps status=canceled → canceled with canceledAt, on customer.subscription.deleted', () => {
    const fields = extractStripeSubscriptionFields(
      makeEvent({ id: 'sub_1', status: 'canceled', canceled_at: 1753776000 }, 'customer.subscription.deleted'),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.CANCELED);
    expect(fields?.canceledAt).toEqual(new Date(1753776000 * 1000));
    // canceled is not terminal here — endedAt stays null
    expect(fields?.endedAt).toBeNull();
  });

  it('reads status from the object regardless of event type (Stripe status is authoritative)', () => {
    // Even on a .updated event, a canceled status must map to canceled — unlike
    // some providers, Stripe status is NOT inferred from the event type.
    const fields = extractStripeSubscriptionFields(
      makeEvent({ id: 'sub_1', status: 'canceled' }, 'customer.subscription.updated'),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.CANCELED);
  });

  it('parses annual interval from items.data[0].price.recurring.interval=year', () => {
    const fields = extractStripeSubscriptionFields(
      makeEvent({
        id: 'sub_1',
        status: 'active',
        items: { data: [{ price: { recurring: { interval: 'year' } } }] },
      }),
    );
    expect(fields?.interval).toBe(BillingInterval.ANNUAL);
  });

  it('defaults to monthly interval', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'active' }));
    expect(fields?.interval).toBe(BillingInterval.MONTHLY);
  });

  it('falls back to a 1-month window when period dates are missing', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'active' }));
    expect(fields).not.toBeNull();
    const startMs = fields!.currentPeriodStart.getTime();
    const endMs = fields!.currentPeriodEnd.getTime();
    expect(endMs - startMs).toBeGreaterThan(28 * 24 * 60 * 60 * 1000);
    expect(endMs - startMs).toBeLessThan(32 * 24 * 60 * 60 * 1000);
  });

  it('parses current_period_start/end as unix seconds', () => {
    const fields = extractStripeSubscriptionFields(
      makeEvent({ id: 'sub_1', status: 'active', current_period_start: 1753776000, current_period_end: 1756368000 }),
    );
    expect(fields?.currentPeriodStart).toEqual(new Date(1753776000 * 1000));
    expect(fields?.currentPeriodEnd).toEqual(new Date(1756368000 * 1000));
  });

  it('stamps metadata with the stripe event id + type + occurred_at + raw status', () => {
    const fields = extractStripeSubscriptionFields(makeEvent({ id: 'sub_1', status: 'active' }));
    expect(fields?.metadata.stripe_event_id).toBe('evt_1');
    expect(fields?.metadata.stripe_event_type).toBe('customer.subscription.updated');
    expect(fields?.metadata.occurred_at).toBe('2026-07-27T10:00:00Z');
    expect(fields?.metadata.raw_status).toBe('active');
  });
});
