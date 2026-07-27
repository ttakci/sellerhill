// apps/api/src/modules/billing/paddle-event-applier.spec.ts
//
// Pure tests for extractSubscriptionFields — the extraction logic that turns
// a Paddle webhook payload into DB-shaped subscription fields. The impure
// applyPaddleEvent (which calls the repository) is not tested here; it is an
// orchestrator over repository methods that are themselves DB-backed.

import { BillingInterval, BillingSubscriptionStatus } from '@repo/shared';

import type { ParsedPaddleEvent } from './billing.types';
import { extractSubscriptionFields } from './paddle-event-applier';

function makeEvent(data: Record<string, unknown>, eventType = 'subscription.activated'): ParsedPaddleEvent {
  return {
    eventId: 'evt_1',
    eventType,
    occurredAt: '2026-07-27T10:00:00Z',
    payload: { data } as never,
  };
}

describe('extractSubscriptionFields', () => {
  it('returns null for an unknown event type', () => {
    expect(extractSubscriptionFields(makeEvent({}, 'unknown.event'))).toBeNull();
  });

  it('returns null when the payload has no subscription object', () => {
    expect(extractSubscriptionFields(makeEvent({ subscription: null }))).toBeNull();
  });

  it('returns null when the subscription has no id', () => {
    expect(extractSubscriptionFields(makeEvent({ subscription: { status: 'active' } }))).toBeNull();
  });

  it('maps subscription.created → trialing', () => {
    const fields = extractSubscriptionFields(
      makeEvent(
        {
          subscription: {
            id: 'sub_1',
            started_at: '2026-07-01T00:00:00Z',
            ended_at: '2026-08-01T00:00:00Z',
          },
        },
        'subscription.created',
      ),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.TRIALING);
    expect(fields?.providerSubscriptionId).toBe('sub_1');
    expect(fields?.canceledAt).toBeNull();
    expect(fields?.endedAt).toBeNull();
  });

  it('maps subscription.activated → active', () => {
    const fields = extractSubscriptionFields(
      makeEvent({ subscription: { id: 'sub_1' } }, 'subscription.activated'),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.ACTIVE);
  });

  it('maps subscription.canceled → canceled with canceledAt', () => {
    const fields = extractSubscriptionFields(
      makeEvent(
        {
          subscription: {
            id: 'sub_1',
            canceled_at: '2026-07-15T00:00:00Z',
            started_at: '2026-07-01T00:00:00Z',
            ended_at: '2026-08-01T00:00:00Z',
          },
        },
        'subscription.canceled',
      ),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.CANCELED);
    expect(fields?.canceledAt).toEqual(new Date('2026-07-15T00:00:00Z'));
    // canceled_at set, ended_at should NOT be set (canceled is not terminal here)
    expect(fields?.endedAt).toBeNull();
  });

  it('maps subscription.past_due → past_due', () => {
    const fields = extractSubscriptionFields(
      makeEvent({ subscription: { id: 'sub_1' } }, 'subscription.past_due'),
    );
    expect(fields?.status).toBe(BillingSubscriptionStatus.PAST_DUE);
  });

  it('parses annual interval from billing_period.interval=year', () => {
    const fields = extractSubscriptionFields(
      makeEvent({
        subscription: {
          id: 'sub_1',
          billing_period: { interval: 'year' },
          started_at: '2026-01-01T00:00:00Z',
          ended_at: '2027-01-01T00:00:00Z',
        },
      }),
    );
    expect(fields?.interval).toBe(BillingInterval.ANNUAL);
  });

  it('defaults to monthly interval', () => {
    const fields = extractSubscriptionFields(
      makeEvent({ subscription: { id: 'sub_1' } }),
    );
    expect(fields?.interval).toBe(BillingInterval.MONTHLY);
  });

  it('falls back to a 1-month window when period dates are missing', () => {
    const fields = extractSubscriptionFields(
      makeEvent({ subscription: { id: 'sub_1' } }),
    );
    expect(fields).not.toBeNull();
    const startMs = fields!.currentPeriodStart.getTime();
    const endMs = fields!.currentPeriodEnd.getTime();
    // ~30 days between start and end
    expect(endMs - startMs).toBeGreaterThan(28 * 24 * 60 * 60 * 1000);
    expect(endMs - startMs).toBeLessThan(32 * 24 * 60 * 60 * 1000);
  });

  it('stamps metadata with event id + type + occurred_at', () => {
    const fields = extractSubscriptionFields(
      makeEvent({ subscription: { id: 'sub_1' } }, 'subscription.updated'),
    );
    expect(fields?.metadata.paddle_event_id).toBe('evt_1');
    expect(fields?.metadata.paddle_event_type).toBe('subscription.updated');
    expect(fields?.metadata.occurred_at).toBe('2026-07-27T10:00:00Z');
  });
});
