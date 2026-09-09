// apps/api/src/modules/billing/billing-helpers.spec.ts
//
// Pure-logic tests for the billing helpers. No DB, no NestJS — mirrors the
// profit-calculation.spec.ts / order-matcher.spec.ts style.

import {
  BillingInterval,
  BillingLimitKey,
  BillingSubscriptionStatus,
} from '@repo/shared';

import {
  buildSubscriptionsQuery,
  buildSubscriptionUpsertSql,
  deriveSummaryTransition,
  expandPlan,
  isProviderConfigured,
  isStaleEvent,
  resolveBillingConfig,
} from './billing-helpers';
import { BillingProvider } from './billing.types';


// ---------------------------------------------------------------------------
// resolveBillingConfig / isProviderConfigured
// ---------------------------------------------------------------------------

describe('resolveBillingConfig', () => {
  it('reports provider=local + enforcement off when Stripe is not configured', () => {
    const config = resolveBillingConfig({});
    expect(config.provider).toBe(BillingProvider.LOCAL);
    expect(config.stripeSecretKey).toBeNull();
    expect(config.enforcementEnabled).toBe(false);
    expect(config.webhookStaleMinutes).toBe(1440);
    expect(config.webhookMaxAttempts).toBe(5);
  });

  it('reports provider=stripe as soon as the secret key is present', () => {
    const config = resolveBillingConfig({ STRIPE_SECRET_KEY: 'sk_test_x' });
    expect(config.provider).toBe(BillingProvider.STRIPE);
    expect(config.stripeSecretKey).toBe('sk_test_x');
  });

  it('carries the webhook secret through independently of the secret key', () => {
    expect(resolveBillingConfig({ STRIPE_WEBHOOK_SECRET: 'whsec_x' }).stripeWebhookSecret).toBe('whsec_x');
    expect(resolveBillingConfig({}).stripeWebhookSecret).toBeNull();
  });

  it('defaults frontendUrl to localhost:5173, overridable via FRONTEND_URL', () => {
    expect(resolveBillingConfig({}).frontendUrl).toBe('http://localhost:5173');
    expect(resolveBillingConfig({ FRONTEND_URL: 'https://app.example.com' }).frontendUrl).toBe(
      'https://app.example.com',
    );
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
  it('gates on the Stripe secret key being present', () => {
    expect(isProviderConfigured({ stripeSecretKey: 'sk_test_x' } as never)).toBe(true);
    expect(isProviderConfigured({ stripeSecretKey: null } as never)).toBe(false);
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

// ---------------------------------------------------------------------------
// buildSubscriptionUpsertSql — the monotonic current_period_start guard
// ---------------------------------------------------------------------------

describe('buildSubscriptionUpsertSql', () => {
  it('is a valid upsert in both modes (ON CONFLICT + RETURNING)', () => {
    for (const sql of [buildSubscriptionUpsertSql(false), buildSubscriptionUpsertSql(true)]) {
      expect(sql).toContain('INSERT INTO billing_subscriptions');
      expect(sql).toContain(
        'ON CONFLICT (provider_subscription_id) WHERE provider_subscription_id IS NOT NULL',
      );
      expect(sql).toContain('DO UPDATE SET');
      expect(sql.trimEnd().endsWith('RETURNING *')).toBe(true);
    }
  });

  it('the webhook path (allowPeriodRewind=false) refuses a backward period start', () => {
    // An out-of-order redelivery must not rewrite the quota window's anchor
    // backward — the UPDATE is guarded so it becomes a no-op instead.
    const sql = buildSubscriptionUpsertSql(false);
    expect(sql).toContain(
      'WHERE EXCLUDED.current_period_start >= billing_subscriptions.current_period_start',
    );
    // The guard sits between the SET list and RETURNING (it is a DO UPDATE …
    // WHERE, not a statement-level WHERE).
    expect(sql.indexOf('WHERE EXCLUDED.current_period_start')).toBeGreaterThan(
      sql.indexOf('updated_at = NOW()'),
    );
    expect(sql.indexOf('WHERE EXCLUDED.current_period_start')).toBeLessThan(
      sql.indexOf('RETURNING *'),
    );
  });

  it('reconcile (allowPeriodRewind=true) drops the guard so it can write Stripe’s real earlier start', () => {
    const sql = buildSubscriptionUpsertSql(true);
    expect(sql).not.toContain('EXCLUDED.current_period_start >=');
  });
});
