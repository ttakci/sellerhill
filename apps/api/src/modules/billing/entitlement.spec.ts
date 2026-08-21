// apps/api/src/modules/billing/entitlement.spec.ts
//
// The function under test lives in packages/shared; the Jest harness lives
// here, so it is exercised through @repo/shared like `fulfillment-state.spec.ts`
// does for `deriveFulfillmentState`.

import {
  BillingSubscriptionStatus,
  ENTITLED_SUBSCRIPTION_STATUSES,
  EntitlementState,
  isEntitlementSuspended,
  resolveEntitlementState,
} from '@repo/shared';

describe('resolveEntitlementState', () => {
  it('grants entitlement while active or trialing', () => {
    expect(resolveEntitlementState(BillingSubscriptionStatus.ACTIVE)).toBe(EntitlementState.ACTIVE);
    expect(resolveEntitlementState(BillingSubscriptionStatus.TRIALING)).toBe(
      EntitlementState.ACTIVE,
    );
  });

  it('suspends from the first failed charge — past_due is not a grace period', () => {
    expect(resolveEntitlementState(BillingSubscriptionStatus.PAST_DUE)).toBe(
      EntitlementState.SUSPENDED,
    );
  });

  it('suspends a cancelled subscription and an expired trial', () => {
    expect(resolveEntitlementState(BillingSubscriptionStatus.CANCELED)).toBe(
      EntitlementState.SUSPENDED,
    );
    expect(resolveEntitlementState(BillingSubscriptionStatus.ENDED)).toBe(
      EntitlementState.SUSPENDED,
    );
  });

  it('reports NONE — not SUSPENDED — when there is no subscription at all', () => {
    // Load-bearing: NONE is the pre-billing state every account is in today and
    // callers fail open on it. Collapsing it into SUSPENDED would lock out every
    // existing user the moment enforcement is switched on.
    expect(resolveEntitlementState(null)).toBe(EntitlementState.NONE);
    expect(resolveEntitlementState(undefined)).toBe(EntitlementState.NONE);
  });

  it('covers every declared subscription status', () => {
    // Guards against a new status being added to the enum without a decision
    // here — it would otherwise silently fall through to NONE (fail open),
    // which is the wrong default for anything money-related.
    for (const status of Object.values(BillingSubscriptionStatus)) {
      expect(resolveEntitlementState(status)).not.toBe(EntitlementState.NONE);
    }
  });
});

describe('isEntitlementSuspended', () => {
  it('is true only for SUSPENDED', () => {
    expect(isEntitlementSuspended(EntitlementState.SUSPENDED)).toBe(true);
    expect(isEntitlementSuspended(EntitlementState.ACTIVE)).toBe(false);
    expect(isEntitlementSuspended(EntitlementState.NONE)).toBe(false);
  });
});

describe('ENTITLED_SUBSCRIPTION_STATUSES', () => {
  it('matches exactly the statuses the function calls ACTIVE', () => {
    // The refresh claim builds SQL from this list instead of calling the
    // function, so the two must not be able to disagree.
    const fromFunction = Object.values(BillingSubscriptionStatus).filter(
      (status) => resolveEntitlementState(status) === EntitlementState.ACTIVE,
    );
    expect([...ENTITLED_SUBSCRIPTION_STATUSES].sort()).toEqual(fromFunction.sort());
  });

  it('contains only plain lowercase values safe to interpolate into SQL', () => {
    for (const status of ENTITLED_SUBSCRIPTION_STATUSES) {
      expect(status).toMatch(/^[a-z_]+$/);
    }
  });
});
