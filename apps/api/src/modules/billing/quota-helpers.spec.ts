// apps/api/src/modules/billing/quota-helpers.spec.ts
//
// Pure-logic invariant tests for the billing quota helpers. No DB, no Nest.
// These lock the behavioral contract the enforcement service relies on.

import { AutoFulfillBlockedReason, BillingLimitKey } from '@repo/shared';

import {
  advisoryLockKey,
  billingCustomerLockKey,
  buildSourceKey,
  decideQuota,
  isEnforcementEnabled,
  quotaExhaustedBlockedReason,
  reservationTargetFor,
  shouldReleaseOnWorkerFailure,
} from './quota-helpers';

describe('isEnforcementEnabled', () => {
  it('defaults to OFF when env var is absent', () => {
    expect(isEnforcementEnabled({})).toBe(false);
  });

  it('is ON only for the literal "true" / "1" (foundation parseBoolean contract)', () => {
    expect(isEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: 'true' })).toBe(true);
    expect(isEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: '1' })).toBe(true);
  });

  it('is OFF for "false", empty, or any other value', () => {
    expect(isEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: 'false' })).toBe(false);
    expect(isEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: '' })).toBe(false);
    expect(isEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: 'yes' })).toBe(false);
  });
});

describe('decideQuota', () => {
  it('allows when in-use + requested <= limit', () => {
    expect(
      decideQuota({ inUse: 5, limitValue: 10, requested: 5 }).allowed,
    ).toBe(true);
  });

  it('allows when in-use + requested == limit exactly (boundary)', () => {
    expect(
      decideQuota({ inUse: 9, limitValue: 10, requested: 1 }).allowed,
    ).toBe(true);
  });

  it('denies when in-use + requested > limit', () => {
    expect(
      decideQuota({ inUse: 8, limitValue: 10, requested: 5 }).allowed,
    ).toBe(false);
  });

  it('treats -1 (foundation unlimited sentinel) as always allowed', () => {
    expect(
      decideQuota({ inUse: 999_999, limitValue: -1, requested: 100 }).allowed,
    ).toBe(true);
  });

  it('treats 0 (foundation disabled sentinel) as never allowed', () => {
    expect(
      decideQuota({ inUse: 0, limitValue: 0, requested: 1 }).allowed,
    ).toBe(false);
  });

  it('treats negative in-use as 0 (defensive)', () => {
    expect(
      decideQuota({ inUse: -5, limitValue: 1, requested: 1 }).allowed,
    ).toBe(true);
  });

  it('treats zero/negative requested as 1 (defensive — never silently allow 0-cost bypass)', () => {
    expect(
      decideQuota({ inUse: 10, limitValue: 10, requested: 0 }).allowed,
    ).toBe(false);
    expect(
      decideQuota({ inUse: 10, limitValue: 10, requested: -3 }).allowed,
    ).toBe(false);
  });
});

describe('reservationTargetFor', () => {
  it('maps listings limit to the listing reservations table', () => {
    const t = reservationTargetFor(BillingLimitKey.LISTINGS_PER_MONTH, 'create');
    expect(t.table).toBe('billing_listing_reservations');
    expect(t.sourceKeyPrefix).toBe('create');
  });

  it('maps listings publish to the listing reservations table with publish prefix', () => {
    const t = reservationTargetFor(BillingLimitKey.LISTINGS_PER_MONTH, 'publish');
    expect(t.table).toBe('billing_listing_reservations');
    expect(t.sourceKeyPrefix).toBe('publish');
  });

  it('maps AO limit to the AO reservations table', () => {
    const t = reservationTargetFor(BillingLimitKey.AMAZON_ORDERS_PER_MONTH, 'ao');
    expect(t.table).toBe('billing_ao_reservations');
    expect(t.sourceKeyPrefix).toBe('ao');
  });
});

describe('buildSourceKey', () => {
  it('builds create keys from listingJobItemId', () => {
    expect(
      buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, { listingJobItemId: 'job-item-123' }),
    ).toBe('create:job-item-123');
  });

  it('builds publish keys from listingId (publish takes precedence over job-item)', () => {
    expect(
      buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, {
        listingId: 'listing-1',
        listingJobItemId: 'job-item-1',
      }),
    ).toBe('publish:listing-1');
  });

  it('builds AO keys from ebayOrderId', () => {
    expect(
      buildSourceKey(BillingLimitKey.AMAZON_ORDERS_PER_MONTH, { ebayOrderId: '12-34567-89012' }),
    ).toBe('ao:12-34567-89012');
  });

  it('throws for listings without listingId or listingJobItemId', () => {
    expect(() => buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, {})).toThrow();
  });

  it('throws for AO without ebayOrderId', () => {
    expect(() => buildSourceKey(BillingLimitKey.AMAZON_ORDERS_PER_MONTH, {})).toThrow();
  });
});

describe('shouldReleaseOnWorkerFailure', () => {
  describe('amazon_orders', () => {
    it('releases on blocked (terminal)', () => {
      expect(
        shouldReleaseOnWorkerFailure({
          kind: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
          isLastAttempt: false,
          blocked: true,
        }),
      ).toBe(true);
    });

    it('releases on final-attempt transport failure', () => {
      expect(
        shouldReleaseOnWorkerFailure({
          kind: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
          isLastAttempt: true,
          blocked: false,
        }),
      ).toBe(true);
    });

    it('HOLDS on intermediate transport failure (BullMQ retry keeps the hold)', () => {
      expect(
        shouldReleaseOnWorkerFailure({
          kind: BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
          isLastAttempt: false,
          blocked: false,
        }),
      ).toBe(false);
    });
  });

  describe('active_listings', () => {
    it('releases on terminal ERROR (isLastAttempt = true)', () => {
      expect(
        shouldReleaseOnWorkerFailure({
          kind: BillingLimitKey.LISTINGS_PER_MONTH,
          isLastAttempt: true,
        }),
      ).toBe(true);
    });

    it('HOLDS on intermediate RETRYING (isLastAttempt = false)', () => {
      expect(
        shouldReleaseOnWorkerFailure({
          kind: BillingLimitKey.LISTINGS_PER_MONTH,
          isLastAttempt: false,
        }),
      ).toBe(false);
    });
  });
});

describe('quotaExhaustedBlockedReason', () => {
  it('returns the shared AutoFulfillBlockedReason.QUOTA_EXHAUSTED enum value', () => {
    expect(quotaExhaustedBlockedReason()).toBe(AutoFulfillBlockedReason.QUOTA_EXHAUSTED);
  });

  it('never returns a raw string — always the enum (CLAUDE.md rule 10)', () => {
    const r = quotaExhaustedBlockedReason();
    expect(r).toBe('quota_exhausted');
    expect(Object.values(AutoFulfillBlockedReason)).toContain(r);
  });
});

describe('advisoryLockKey', () => {
  it('is deterministic for the same (subscription, kind)', () => {
    const a = advisoryLockKey('sub-123', BillingLimitKey.LISTINGS_PER_MONTH);
    const b = advisoryLockKey('sub-123', BillingLimitKey.LISTINGS_PER_MONTH);
    expect(a).toEqual(b);
  });

  it('differs by kind discriminator (key1)', () => {
    const listings = advisoryLockKey('sub-123', BillingLimitKey.LISTINGS_PER_MONTH);
    const ao = advisoryLockKey('sub-123', BillingLimitKey.AMAZON_ORDERS_PER_MONTH);
    expect(listings.key1).not.toBe(ao.key1);
  });

  it('differs by subscription (key2)', () => {
    const a = advisoryLockKey('sub-123', BillingLimitKey.LISTINGS_PER_MONTH);
    const b = advisoryLockKey('sub-456', BillingLimitKey.LISTINGS_PER_MONTH);
    expect(a.key2).not.toBe(b.key2);
  });

  it('key1 is 1 for listings, 2 for AO', () => {
    expect(advisoryLockKey('x', BillingLimitKey.LISTINGS_PER_MONTH).key1).toBe(1);
    expect(advisoryLockKey('x', BillingLimitKey.AMAZON_ORDERS_PER_MONTH).key1).toBe(2);
  });
});

describe('billingCustomerLockKey', () => {
  it('is deterministic for the same user id', () => {
    const a = billingCustomerLockKey('user-123');
    const b = billingCustomerLockKey('user-123');
    expect(a).toEqual(b);
  });

  it('differs by user id (key2)', () => {
    const a = billingCustomerLockKey('user-123');
    const b = billingCustomerLockKey('user-456');
    expect(a.key2).not.toBe(b.key2);
  });

  it('never collides with a quota-reservation lock, whatever key2 hashes to', () => {
    // pg_advisory_xact_lock keys on the (key1, key2) PAIR, so this only needs
    // key1 to differ from every value LOCK_DISCRIMINATOR can produce (plus the
    // unreachable 0 fallback) — it does not matter whether key2 happens to
    // collide with a quota lock's key2 for some other id.
    //
    // Enumerated programmatically over the real enum (Object.values), not
    // hand-picked members: BillingLimitKey has grown before (AO ->
    // AO+conversions) and a hand-picked pair silently stops covering a new
    // member the moment one is added, which is exactly the kind of omission
    // this guard exists to catch.
    const customerLock = billingCustomerLockKey('any-user');
    expect(customerLock.key1).not.toBe(0);
    for (const kind of Object.values(BillingLimitKey)) {
      const lock = advisoryLockKey('any-user', kind);
      expect(customerLock.key1).not.toBe(lock.key1);
    }
  });
});
