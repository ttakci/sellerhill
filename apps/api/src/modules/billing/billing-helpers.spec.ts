// apps/api/src/modules/billing/billing-helpers.spec.ts
//
// Pure-logic tests for the billing helpers. No DB, no NestJS — mirrors the
// profit-calculation.spec.ts / order-matcher.spec.ts style.

import { createHmac } from 'node:crypto';

import {
  BillingInterval,
  BillingLimitKey,
  BillingSubscriptionStatus,
} from '@repo/shared';

import {
  buildSubscriptionsQuery,
  deriveSummaryTransition,
  expandPlan,
  isProviderConfigured,
  isStaleEvent,
  parsePaddleEvent,
  parseSignatureHeader,
  resolveBillingConfig,
  verifyPaddleSignature,
} from './billing-helpers';
import { BillingProvider } from './billing.types';


// ---------------------------------------------------------------------------
// resolveBillingConfig / isProviderConfigured
// ---------------------------------------------------------------------------

describe('resolveBillingConfig', () => {
  it('defaults to local provider + enforcement off when no Paddle env', () => {
    const config = resolveBillingConfig({});
    expect(config.provider).toBe(BillingProvider.LOCAL);
    expect(config.enforcementEnabled).toBe(false);
    expect(config.webhookStaleMinutes).toBe(1440);
    expect(config.webhookMaxAttempts).toBe(5);
  });

  it('selects paddle provider only when BOTH api key and webhook secret are set', () => {
    expect(resolveBillingConfig({ PADDLE_API_KEY: 'k' }).provider).toBe(BillingProvider.LOCAL);
    expect(resolveBillingConfig({ PADDLE_WEBHOOK_SECRET: 's' }).provider).toBe(BillingProvider.LOCAL);
    expect(
      resolveBillingConfig({ PADDLE_API_KEY: 'k', PADDLE_WEBHOOK_SECRET: 's' }).provider,
    ).toBe(BillingProvider.PADDLE);
  });

  it('parses enforcement flag as boolean (case-insensitive)', () => {
    expect(resolveBillingConfig({ BILLING_ENFORCEMENT_ENABLED: 'true' }).enforcementEnabled).toBe(true);
    expect(resolveBillingConfig({ BILLING_ENFORCEMENT_ENABLED: 'TRUE' }).enforcementEnabled).toBe(true);
    expect(resolveBillingConfig({ BILLING_ENFORCEMENT_ENABLED: '1' }).enforcementEnabled).toBe(true);
    expect(resolveBillingConfig({ BILLING_ENFORCEMENT_ENABLED: 'false' }).enforcementEnabled).toBe(false);
    expect(resolveBillingConfig({ BILLING_ENFORCEMENT_ENABLED: 'no' }).enforcementEnabled).toBe(false);
  });

  it('parses numeric env with fallback on garbage', () => {
    expect(resolveBillingConfig({ BILLING_WEBHOOK_STALE_MINUTES: '60' }).webhookStaleMinutes).toBe(60);
    expect(resolveBillingConfig({ BILLING_WEBHOOK_STALE_MINUTES: 'garbage' }).webhookStaleMinutes).toBe(1440);
  });
});

describe('isProviderConfigured', () => {
  it('returns true for paddle, false for local', () => {
    expect(isProviderConfigured({ provider: BillingProvider.PADDLE } as never)).toBe(true);
    expect(isProviderConfigured({ provider: BillingProvider.LOCAL } as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveSummaryTransition (fail-safe: no fake subscription)
// ---------------------------------------------------------------------------

describe('deriveSummaryTransition', () => {
  it('returns full_access when enforcement is off, regardless of subscription', () => {
    expect(deriveSummaryTransition(false, null)).toBe('full_access');
    expect(deriveSummaryTransition(false, BillingSubscriptionStatus.ACTIVE)).toBe('full_access');
    expect(deriveSummaryTransition(false, BillingSubscriptionStatus.ENDED)).toBe('full_access');
  });

  it('returns no_subscription when enforcement on and no subscription', () => {
    expect(deriveSummaryTransition(true, null)).toBe('no_subscription');
  });

  it('returns active for active/trialing subscriptions under enforcement', () => {
    expect(deriveSummaryTransition(true, BillingSubscriptionStatus.ACTIVE)).toBe('active');
    expect(deriveSummaryTransition(true, BillingSubscriptionStatus.TRIALING)).toBe('active');
  });

  it('returns past_due for past_due subscriptions', () => {
    expect(deriveSummaryTransition(true, BillingSubscriptionStatus.PAST_DUE)).toBe('past_due');
  });

  it('returns no_subscription for canceled/ended (no active entitlement)', () => {
    expect(deriveSummaryTransition(true, BillingSubscriptionStatus.CANCELED)).toBe('no_subscription');
    expect(deriveSummaryTransition(true, BillingSubscriptionStatus.ENDED)).toBe('no_subscription');
  });
});

// ---------------------------------------------------------------------------
// isStaleEvent
// ---------------------------------------------------------------------------

describe('isStaleEvent', () => {
  const now = new Date('2026-07-27T12:00:00Z');

  it('returns false when staleMinutes is 0 (disabled)', () => {
    expect(isStaleEvent('2020-01-01T00:00:00Z', 0, now)).toBe(false);
  });

  it('returns false when occurredAt is null (cannot prove stale)', () => {
    expect(isStaleEvent(null, 1440, now)).toBe(false);
  });

  it('returns true when event is older than the TTL', () => {
    // 2 days ago, TTL 1 day
    const old = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStaleEvent(old, 1440, now)).toBe(true);
  });

  it('returns false when event is within the TTL', () => {
    // 1 hour ago, TTL 1 day
    const recent = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    expect(isStaleEvent(recent, 1440, now)).toBe(false);
  });

  it('returns false on unparseable occurredAt', () => {
    expect(isStaleEvent('not-a-date', 1440, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseSignatureHeader / verifyPaddleSignature
// ---------------------------------------------------------------------------

describe('parseSignatureHeader', () => {
  it('parses ts and h1', () => {
    expect(parseSignatureHeader('ts=1700000000;h1=abc123')).toEqual({ ts: '1700000000', h1: 'abc123' });
  });

  it('handles whitespace between segments', () => {
    expect(parseSignatureHeader('ts=1700000000; h1=abc123')).toEqual({ ts: '1700000000', h1: 'abc123' });
  });

  it('returns null when ts or h1 is missing', () => {
    expect(parseSignatureHeader('ts=1700000000')).toBeNull();
    expect(parseSignatureHeader('h1=abc123')).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
  });
});

describe('verifyPaddleSignature', () => {
  const secret = 'whsec_test_secret';
  const now = new Date('2026-07-27T12:00:00Z');
  const ts = Math.floor(now.getTime() / 1000).toString();

  function sign(body: string, tsToUse: string = ts): string {
    const h1 = createHmac('sha256', secret).update(`${tsToUse}:${body}`).digest('hex');
    return `ts=${tsToUse};h1=${h1}`;
  }

  it('accepts a valid signature for the exact body', () => {
    const body = '{"event_id":"evt_1"}';
    expect(verifyPaddleSignature(sign(body), body, secret, 300, now)).toBe(true);
  });

  it('rejects when the body was tampered with', () => {
    const body = '{"event_id":"evt_1"}';
    expect(verifyPaddleSignature(sign(body), '{"event_id":"evt_2"}', secret, 300, now)).toBe(false);
  });

  it('rejects when the secret is wrong', () => {
    const body = '{"event_id":"evt_1"}';
    expect(verifyPaddleSignature(sign(body), body, 'wrong-secret', 300, now)).toBe(false);
  });

  it('rejects when the header is missing', () => {
    expect(verifyPaddleSignature(undefined, 'body', secret, 300, now)).toBe(false);
  });

  it('rejects when the secret is empty', () => {
    expect(verifyPaddleSignature(sign('body'), 'body', '', 300, now)).toBe(false);
  });

  it('rejects when the timestamp is outside the tolerance window (replay protection)', () => {
    // 10 minutes ago, tolerance 5 minutes
    const oldTs = Math.floor(now.getTime() / 1000) - 600;
    const body = 'body';
    expect(verifyPaddleSignature(sign(body, oldTs.toString()), body, secret, 300, now)).toBe(false);
  });

  it('accepts a timestamp within the tolerance window', () => {
    // 2 minutes ago, tolerance 5 minutes
    const nearTs = Math.floor(now.getTime() / 1000) - 120;
    const body = 'body';
    expect(verifyPaddleSignature(sign(body, nearTs.toString()), body, secret, 300, now)).toBe(true);
  });

  it('rejects a malformed header', () => {
    expect(verifyPaddleSignature('garbage', 'body', secret, 300, now)).toBe(false);
  });

  it('uses constant-time comparison (does not throw on length mismatch)', () => {
    // h1 of wrong length should return false, not throw
    expect(verifyPaddleSignature('ts=1700000000;h1=short', 'body', secret, 300, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parsePaddleEvent
// ---------------------------------------------------------------------------

describe('parsePaddleEvent', () => {
  it('extracts event_id, event_type, occurred_at from a Paddle payload', () => {
    const payload = {
      event_id: 'evt_abc',
      event_type: 'subscription.activated',
      occurred_at: '2026-07-27T10:00:00Z',
      data: { id: 'sub_1' },
    };
    const event = parsePaddleEvent(payload);
    expect(event.eventId).toBe('evt_abc');
    expect(event.eventType).toBe('subscription.activated');
    expect(event.occurredAt).toBe('2026-07-27T10:00:00Z');
    expect(event.payload).toBe(payload);
  });

  it('coerces missing fields to null / "unknown"', () => {
    const event = parsePaddleEvent({ foo: 'bar' });
    expect(event.eventId).toBeNull();
    expect(event.eventType).toBe('unknown');
    expect(event.occurredAt).toBeNull();
  });

  it('handles non-object input safely', () => {
    const event = parsePaddleEvent('not-an-object');
    expect(event.eventId).toBeNull();
    expect(event.eventType).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// expandPlan
// ---------------------------------------------------------------------------

describe('expandPlan', () => {
  const now = new Date('2026-07-27T00:00:00Z');
  const plan = {
    id: 'plan-1',
    slug: 'starter',
    name: 'Starter',
    description: null,
    isActive: true,
    displayOrder: 10,
    providerProductId: 'prod_1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('selects the effective price per interval (open-ended current price)', () => {
    const prices = [
      {
        id: 'p1', planId: 'plan-1', interval: BillingInterval.MONTHLY,
        amountMicros: 39_000_000, currency: 'USD',
        effectiveFrom: '2026-01-01', effectiveTo: null,
        providerPriceId: 'pri_monthly', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'p2', planId: 'plan-1', interval: BillingInterval.ANNUAL,
        amountMicros: 390_000_000, currency: 'USD',
        effectiveFrom: '2026-01-01', effectiveTo: null,
        providerPriceId: 'pri_annual', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const limits = [
      {
        id: 'l1', planId: 'plan-1', limitKey: BillingLimitKey.LISTINGS_PER_MONTH,
        limitValue: 1500, unit: 'listings', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const expanded = expandPlan(plan, prices, limits, now);
    expect(expanded.prices[BillingInterval.MONTHLY]?.amountMicros).toBe(39_000_000);
    expect(expanded.prices[BillingInterval.ANNUAL]?.amountMicros).toBe(390_000_000);
    expect(expanded.limits[BillingLimitKey.LISTINGS_PER_MONTH]?.limitValue).toBe(1500);
  });

  it('excludes prices whose effective window has not started', () => {
    const prices = [
      {
        id: 'p1', planId: 'plan-1', interval: BillingInterval.MONTHLY,
        amountMicros: 39_000_000, currency: 'USD',
        effectiveFrom: '2027-01-01', effectiveTo: null, // future
        providerPriceId: 'pri', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const expanded = expandPlan(plan, prices, [], now);
    expect(expanded.prices[BillingInterval.MONTHLY]).toBeUndefined();
  });

  it('excludes prices whose effective window has ended', () => {
    const prices = [
      {
        id: 'p1', planId: 'plan-1', interval: BillingInterval.MONTHLY,
        amountMicros: 30_000_000, currency: 'USD',
        effectiveFrom: '2025-01-01', effectiveTo: '2026-01-01', // ended
        providerPriceId: 'pri', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
      },
    ];
    const expanded = expandPlan(plan, prices, [], now);
    expect(expanded.prices[BillingInterval.MONTHLY]).toBeUndefined();
  });

  it('ignores prices and limits for other plans', () => {
    const prices = [
      {
        id: 'p1', planId: 'other-plan', interval: BillingInterval.MONTHLY,
        amountMicros: 99_000_000, currency: 'USD',
        effectiveFrom: '2026-01-01', effectiveTo: null,
        providerPriceId: 'pri', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const expanded = expandPlan(plan, prices, [], now);
    expect(expanded.prices[BillingInterval.MONTHLY]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildSubscriptionsQuery
// ---------------------------------------------------------------------------

describe('buildSubscriptionsQuery', () => {
  it('returns empty where when no filters', () => {
    const { where, params } = buildSubscriptionsQuery({});
    expect(where).toBe('');
    expect(params).toEqual([]);
  });

  it('builds customer_id filter', () => {
    const { where, params } = buildSubscriptionsQuery({ customerId: 'c1' });
    expect(where).toContain('customer_id = $1');
    expect(params).toEqual(['c1']);
  });

  it('builds user_id filter via subquery', () => {
    const { where, params } = buildSubscriptionsQuery({ userId: 'u1' });
    expect(where).toContain('billing_customers');
    expect(where).toContain('user_id = $1');
    expect(params).toEqual(['u1']);
  });

  it('combines multiple filters with AND', () => {
    const { where, params } = buildSubscriptionsQuery({
      customerId: 'c1',
      status: BillingSubscriptionStatus.ACTIVE,
    });
    expect(where).toContain('AND');
    expect(params).toEqual(['c1', BillingSubscriptionStatus.ACTIVE]);
  });

  it('builds activeAt window filter', () => {
    const { where, params } = buildSubscriptionsQuery({ activeAt: '2026-07-27T12:00:00Z' });
    expect(where).toContain('current_period_start');
    expect(where).toContain('current_period_end');
    expect(params).toEqual(['2026-07-27T12:00:00Z']);
  });
});
