// apps/api/src/modules/billing/listing-plan-limit.spec.ts
import { decideListingPlanLimitAction, ListingPlanLimitAction } from './listing-plan-limit';

describe('decideListingPlanLimitAction', () => {
  it('does nothing for a seller under the limit with no flags', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 150, flaggedCount: 0, limitValue: 200 }),
    ).toBe(ListingPlanLimitAction.NONE);
  });

  it('does nothing at exactly the limit', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 200, flaggedCount: 0, limitValue: 200 }),
    ).toBe(ListingPlanLimitAction.NONE);
  });

  it('ranks a seller over the limit', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 201, flaggedCount: 0, limitValue: 200 }),
    ).toBe(ListingPlanLimitAction.RANK);
  });

  it('re-ranks an already-flagged seller who is still over', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 900, flaggedCount: 400, limitValue: 500 }),
    ).toBe(ListingPlanLimitAction.RANK);
  });

  it('clears stale flags once the seller is back within the limit (upgrade or ended listings)', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 480, flaggedCount: 12, limitValue: 500 }),
    ).toBe(ListingPlanLimitAction.CLEAR);
  });

  it('treats no subscription and unlimited as nothing over the limit', () => {
    expect(
      decideListingPlanLimitAction({ activeCount: 5000, flaggedCount: 3, limitValue: null }),
    ).toBe(ListingPlanLimitAction.CLEAR);
    expect(
      decideListingPlanLimitAction({ activeCount: 5000, flaggedCount: 0, limitValue: -1 }),
    ).toBe(ListingPlanLimitAction.NONE);
  });
});
