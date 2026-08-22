// packages/shared/src/domain/billing/plan-change.ts

/**
 * Which way a plan change goes, and therefore how it is billed.
 *
 * Stripe subscriptions bill in ADVANCE, so an upgrade hands the seller the
 * higher quota immediately. Charging the prorated difference later would let a
 * Lite seller move to Enterprise on day 1, consume 25,000 listings and 800
 * conversions (~$80 of real Aquiline cost), and let the card fail before the
 * invoice arrives. Upgrades are therefore charged now.
 *
 * A downgrade is the mirror: the seller has already paid for the current
 * period, so they keep what they paid for until it ends.
 */
export enum PlanChangeDirection {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
}

/**
 * Compare two plan prices in micro-units of the same currency.
 *
 * Equal prices resolve to UPGRADE — an immediate, $0 change — rather than
 * being left undefined. Twelve distinct tiers make it unreachable in practice;
 * defining it costs nothing and removes a branch nobody would have tested.
 */
export function resolvePlanChangeDirection(
  currentAmountMicros: number,
  targetAmountMicros: number,
): PlanChangeDirection {
  return targetAmountMicros >= currentAmountMicros
    ? PlanChangeDirection.UPGRADE
    : PlanChangeDirection.DOWNGRADE;
}
