// apps/api/src/modules/billing/quota-measures.spec.ts
//
// Pure tests for the two pieces the three quota measures are built on: the
// UTC month boundary that makes a monthly meter reset, and the advisory-lock
// discriminator that keeps the three meters from serialising against each
// other.
//
// Both existed in some form before and both were wrong in ways that only
// surfaced with enforcement on: nothing ever opened a usage period, so the
// month boundary was never consulted at all, and the lock discriminator
// collapsed every non-listing dimension onto a single key.

import { BillingLimitKey } from '@repo/shared';

import { advisoryLockKey, decideQuota, utcMonthBounds } from './quota-helpers';

describe('utcMonthBounds', () => {
  it('spans the containing UTC calendar month, start inclusive / end exclusive', () => {
    const { periodStart, periodEnd } = utcMonthBounds(new Date('2026-08-21T14:33:07.512Z'));
    expect(periodStart.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(periodEnd.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rolls the year at December', () => {
    const { periodStart, periodEnd } = utcMonthBounds(new Date('2026-12-31T23:59:59.999Z'));
    expect(periodStart.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(periodEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('puts the first instant of a month in that month, not the previous one', () => {
    // An off-by-one here would hand every seller a second allowance on the 1st.
    const { periodStart } = utcMonthBounds(new Date('2026-03-01T00:00:00.000Z'));
    expect(periodStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('uses UTC, not the host timezone', () => {
    // 2026-09-01T01:00Z is still August in UTC-3 and already September in UTC.
    // The meter must roll on the UTC instant for every seller, whatever
    // timezone the API process happens to be started in.
    const { periodStart } = utcMonthBounds(new Date('2026-09-01T01:00:00.000Z'));
    expect(periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is stable across two calls in the same month', () => {
    const a = utcMonthBounds(new Date('2026-08-02T00:00:00.000Z'));
    const b = utcMonthBounds(new Date('2026-08-29T23:00:00.000Z'));
    expect(a.periodStart.toISOString()).toBe(b.periodStart.toISOString());
    expect(a.periodEnd.toISOString()).toBe(b.periodEnd.toISOString());
  });
});

describe('advisoryLockKey', () => {
  const SUBSCRIPTION = '5f6c1b0a-1111-2222-3333-444455556666';

  it('gives every metered dimension its own lock', () => {
    // The original was `kind === LISTINGS ? 1 : 2`, so automatic orders and
    // tracking conversions would have shared one lock and serialised against
    // each other for no reason.
    const keys = Object.values(BillingLimitKey).map(
      (kind) => advisoryLockKey(SUBSCRIPTION, kind).key1,
    );
    expect(new Set(keys).size).toBe(Object.values(BillingLimitKey).length);
  });

  it('is stable for the same (subscription, kind) across calls', () => {
    const a = advisoryLockKey(SUBSCRIPTION, BillingLimitKey.AMAZON_ORDERS_PER_MONTH);
    const b = advisoryLockKey(SUBSCRIPTION, BillingLimitKey.AMAZON_ORDERS_PER_MONTH);
    expect(a).toEqual(b);
  });

  it('separates two subscriptions on the same dimension', () => {
    const a = advisoryLockKey(SUBSCRIPTION, BillingLimitKey.LISTINGS_PER_MONTH);
    const b = advisoryLockKey('99998888-7777-6666-5555-444433332222', BillingLimitKey.LISTINGS_PER_MONTH);
    expect(a.key2).not.toBe(b.key2);
  });

  it('produces non-negative 32-bit keys Postgres can accept', () => {
    for (const kind of Object.values(BillingLimitKey)) {
      const { key1, key2 } = advisoryLockKey(SUBSCRIPTION, kind);
      expect(Number.isInteger(key1)).toBe(true);
      expect(Number.isInteger(key2)).toBe(true);
      expect(key2).toBeGreaterThanOrEqual(0);
      expect(key2).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('decideQuota at the boundary', () => {
  // The conversion gate asks this with requested: 1, so these are the exact
  // cases that decide whether the Nth conversion of the month is paid for.
  it('allows the last slot and refuses the one after it', () => {
    expect(decideQuota({ inUse: 99, limitValue: 100, requested: 1 }).allowed).toBe(true);
    expect(decideQuota({ inUse: 100, limitValue: 100, requested: 1 }).allowed).toBe(false);
  });

  it('treats a suspended account (limit 0) as refusing everything', () => {
    // resolveSubscriptionContext reports suspension as limitValue 0 so that
    // every existing caller refuses it through the path it already had.
    expect(decideQuota({ inUse: 0, limitValue: 0, requested: 1 }).allowed).toBe(false);
  });

  it('treats -1 as unlimited', () => {
    expect(decideQuota({ inUse: 10_000, limitValue: -1, requested: 1 }).allowed).toBe(true);
  });
});
