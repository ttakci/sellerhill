// apps/api/src/modules/billing/listing-plan-limit.ts
//
// Which of a seller's ACTIVE listings are automated when they hold more than
// their plan allows. The rule (operator decision, 2026-09-17): the OLDEST
// listings up to the limit stay tracked; everything newer is marked
// `listings.over_plan_limit` and left alone. Pure so the decision is testable;
// the ranking itself is one SQL statement in BillingRepositoryService.

/** What the reconcile job must do for one user. */
export enum ListingPlanLimitAction {
  /** Flags are already correct — no write. */
  NONE = 'none',
  /** Within the limit (or unlimited) but some rows are still flagged. */
  CLEAR = 'clear',
  /** Over the limit — re-rank and flag everything past it. */
  RANK = 'rank',
}

export interface ListingPlanLimitInput {
  /** The user's ACTIVE listings. */
  activeCount: number;
  /** Rows currently carrying `over_plan_limit = TRUE`, any status. */
  flaggedCount: number;
  /**
   * The effective listing limit. `null` = no subscription or no limit declared,
   * `-1` = unlimited. Both mean nothing is over the limit.
   */
  limitValue: number | null;
}

/**
 * Decide the reconcile action without touching the database.
 *
 * RANK is only chosen when the seller is actually over the limit. A seller at
 * or under it needs no ranking at all — every active listing is tracked — so
 * the common case costs a clear (if stale flags exist) or nothing.
 */
export function decideListingPlanLimitAction(input: ListingPlanLimitInput): ListingPlanLimitAction {
  const { activeCount, flaggedCount, limitValue } = input;
  const unlimited = limitValue === null || limitValue === -1;
  if (unlimited || activeCount <= limitValue) {
    return flaggedCount > 0 ? ListingPlanLimitAction.CLEAR : ListingPlanLimitAction.NONE;
  }
  return ListingPlanLimitAction.RANK;
}
