import { BillingInterval, BillingSubscriptionStatus } from '@repo/shared';

import { extractStripeSubscriptionFields } from '../modules/billing/stripe-event-applier';

import {
  buildReconcileEvent,
  parseReconcileArgs,
  RECONCILE_EVENT_TYPE,
  ReconcileArgError,
  resolveReconcilePlanId,
} from './billing-reconcile-helpers';

describe('parseReconcileArgs', () => {
  it('reads --email', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c'])).toEqual({ email: 'a@b.c', dryRun: false });
  });

  it('ignores the literal "--" pnpm run forwards', () => {
    expect(parseReconcileArgs(['--', '--email', 'a@b.c']).email).toBe('a@b.c');
  });

  it('supports --dry-run', () => {
    expect(parseReconcileArgs(['--email', 'a@b.c', '--dry-run']).dryRun).toBe(true);
  });

  it('requires --email', () => {
    expect(() => parseReconcileArgs([])).toThrow(ReconcileArgError);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseReconcileArgs(['--force'])).toThrow(ReconcileArgError);
  });
});

describe('resolveReconcilePlanId', () => {
  it('returns metadata.plan_id when present', () => {
    expect(resolveReconcilePlanId({ metadata: { plan_id: 'plan_growth' } })).toBe('plan_growth');
  });

  it('returns null when plan_id is absent', () => {
    expect(resolveReconcilePlanId({ metadata: {} })).toBeNull();
    expect(resolveReconcilePlanId({})).toBeNull();
  });

  it('returns null for an empty plan_id', () => {
    expect(resolveReconcilePlanId({ metadata: { plan_id: '' } })).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(resolveReconcilePlanId(null)).toBeNull();
    expect(resolveReconcilePlanId('sub_1')).toBeNull();
  });
});

describe('buildReconcileEvent', () => {
  it('wraps the subscription in a mapper-compatible envelope with a deterministic timestamp', () => {
    const now = new Date('2026-09-09T00:00:00.000Z');
    const subscription = { id: 'sub_1' };
    const event = buildReconcileEvent(subscription, now);

    expect(event.eventType).toBe(RECONCILE_EVENT_TYPE);
    expect(event.eventId).toBe('reconcile:2026-09-09T00:00:00.000Z');
    expect(event.occurredAt).toBe('2026-09-09T00:00:00.000Z');
    expect(event.payload).toEqual({ data: { object: subscription } });
  });
});

describe('buildReconcileEvent -> extractStripeSubscriptionFields', () => {
  // A minimal Stripe.Subscription-shaped object: only the fields the mapper reads.
  const baseSubscription = {
    id: 'sub_123',
    status: 'active',
    metadata: { plan_id: 'plan_x' },
    canceled_at: null,
    ended_at: null,
    items: {
      data: [
        {
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          price: { recurring: { interval: 'month' } },
        },
      ],
    },
  };

  it('extracts exactly the expected StripeSubscriptionFields', () => {
    const fields = extractStripeSubscriptionFields(buildReconcileEvent(baseSubscription));

    expect(fields).not.toBeNull();
    expect(fields?.providerSubscriptionId).toBe('sub_123');
    expect(fields?.status).toBe(BillingSubscriptionStatus.ACTIVE);
    expect(fields?.interval).toBe(BillingInterval.MONTHLY);
    expect(fields?.currentPeriodStart.getTime()).toBe(1_700_000_000 * 1000);
    expect(fields?.currentPeriodEnd.getTime()).toBe(1_702_592_000 * 1000);
    expect(fields?.canceledAt).toBeNull();
    expect(fields?.endedAt).toBeNull();
  });

  it('falls back to now()/now()+30d when the item carries no period fields', () => {
    const noPeriods = { ...baseSubscription, items: { data: [{}] } };
    const before = Date.now();
    const fields = extractStripeSubscriptionFields(buildReconcileEvent(noPeriods));
    const after = Date.now();

    expect(fields).not.toBeNull();
    const start = fields?.currentPeriodStart.getTime() ?? 0;
    const end = fields?.currentPeriodEnd.getTime() ?? 0;
    expect(start).toBeGreaterThanOrEqual(before);
    expect(start).toBeLessThanOrEqual(after);
    // The fallback window is exactly 30 days.
    expect(end - start).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('returns null for a status this system does not track', () => {
    const incomplete = { ...baseSubscription, status: 'incomplete' };
    expect(extractStripeSubscriptionFields(buildReconcileEvent(incomplete))).toBeNull();
  });
});
