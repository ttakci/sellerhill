// apps/api/src/modules/billing/plan-change.spec.ts
//
// The function under test lives in packages/shared; the Jest harness lives
// here, so it is exercised through @repo/shared like `fulfillment-state.spec.ts`
// does for `deriveFulfillmentState`.

import { PlanChangeDirection, resolvePlanChangeDirection } from '@repo/shared';

describe('resolvePlanChangeDirection', () => {
  it('reports a higher price as an upgrade', () => {
    expect(resolvePlanChangeDirection(24_990_000, 29_990_000)).toBe(PlanChangeDirection.UPGRADE);
  });

  it('reports a lower price as a downgrade', () => {
    expect(resolvePlanChangeDirection(529_990_000, 19_990_000)).toBe(
      PlanChangeDirection.DOWNGRADE,
    );
  });

  it('treats an equal price as an upgrade, not as undefined behaviour', () => {
    // Impossible across twelve distinct tiers, but "apply immediately for $0"
    // is a defined outcome and "we did not decide" is not.
    expect(resolvePlanChangeDirection(29_990_000, 29_990_000)).toBe(PlanChangeDirection.UPGRADE);
  });
});
