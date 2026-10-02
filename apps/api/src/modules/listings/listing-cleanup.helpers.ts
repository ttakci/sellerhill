import { ListingAutoEndReason, resolveListingRules } from '@repo/shared';

/**
 * What the clean-up sweep may end for ONE store, from that store's resolved
 * listing rules (Store > Global, a store row with no rules inheriting the
 * global ones — the same resolution the create worker uses).
 */
export interface ListingCleanupPlan {
  /** End a listing that stayed at quantity 0 this many days; null = never. */
  outOfStockEndDays: number | null;
  /** End a listing with no sale in this many days; null = never (flag-only or off). */
  notSellingEndDays: number | null;
}

export function planListingCleanup(storeRules: unknown, globalRules: unknown): ListingCleanupPlan {
  const rules = resolveListingRules(storeRules, globalRules);
  return {
    outOfStockEndDays: rules.outOfStockEndDays,
    // Watching alone only flags (Action Center + the list filter); ending
    // needs the seller's explicit second switch.
    notSellingEndDays: rules.coldListingAutoEnd ? rules.coldListingDays : null,
  };
}

export function hasCleanupWork(plan: ListingCleanupPlan): boolean {
  return plan.outOfStockEndDays !== null || plan.notSellingEndDays !== null;
}

/** The steps of a plan, in the order the sweep runs them. */
export function cleanupSteps(plan: ListingCleanupPlan): Array<{ reason: ListingAutoEndReason; days: number }> {
  const steps: Array<{ reason: ListingAutoEndReason; days: number }> = [];
  if (plan.outOfStockEndDays !== null) {
    steps.push({ reason: ListingAutoEndReason.OUT_OF_STOCK, days: plan.outOfStockEndDays });
  }
  if (plan.notSellingEndDays !== null) {
    steps.push({ reason: ListingAutoEndReason.NOT_SELLING, days: plan.notSellingEndDays });
  }
  return steps;
}

/**
 * Candidate query for one step. The two share every safety condition and
 * differ only in what makes a listing "due":
 *
 *  - only ACTIVE listings with an eBay offer id (the Inventory API route —
 *    a legacy listing without one is left for the seller);
 *  - never a listing the seller PAUSED on purpose (`disable_ordering`, or a
 *    quantity locked at 0): its 0 is a decision, not a stock-out;
 *  - not one eBay refused to end within the last day.
 *
 * `$1` user, `$2` store, `$3` days, `$4` limit.
 */
export function buildCleanupCandidateSql(reason: ListingAutoEndReason): string {
  const due =
    reason === ListingAutoEndReason.OUT_OF_STOCK
      ? `l.quantity <= 0
         AND l.quantity_zero_since IS NOT NULL
         AND l.quantity_zero_since <= NOW() - make_interval(days => $3::int)
         AND l.disable_ordering = FALSE
         AND NOT (l.lock_quantity = TRUE AND COALESCE(l.quantity_override, 0) <= 0)`
      : `l.created_at <= NOW() - make_interval(days => $3::int)
         AND NOT EXISTS (
           SELECT 1 FROM orders o
            WHERE o.listing_id = l.id
              AND o.order_date > NOW() - make_interval(days => $3::int)
         )`;
  const order = reason === ListingAutoEndReason.OUT_OF_STOCK ? 'l.quantity_zero_since' : 'l.created_at';
  return `
    SELECT l.id, l.ebay_offer_id
      FROM listings l
     WHERE l.user_id = $1
       AND l.ebay_account_id = $2
       AND l.status = 'active'
       AND l.ebay_offer_id IS NOT NULL
       AND (l.auto_end_failed_at IS NULL OR l.auto_end_failed_at < NOW() - INTERVAL '1 day')
       AND ${due}
     ORDER BY ${order} ASC, l.id ASC
     LIMIT $4::int`;
}

/**
 * "This listing is not selling", by the seller's own window — the ONE
 * predicate behind the Action Center's not-selling item and the listings
 * filter it links to, so the count and the list can never disagree.
 *
 * The window is read per listing from its store's resolved rules (the store
 * row's rules when it has any, otherwise the global row's — the same
 * whole-object inheritance `resolveListingRules` applies; stored rules are
 * always normalized, so the value is a valid day count or absent). A seller
 * who is not watching (`coldListingDays` unset) matches nothing.
 *
 * Counted from the listing's creation when it never sold, so a listing younger
 * than the window is never called slow.
 */
export function buildNotSellingSql(alias: string): string {
  return `EXISTS (
    SELECT 1
      FROM (
        SELECT CASE
                 WHEN s_ns.listing_rules IS NOT NULL THEN (s_ns.listing_rules->>'coldListingDays')::int
                 ELSE (g_ns.listing_rules->>'coldListingDays')::int
               END AS days
          FROM (SELECT 1) one_ns
          LEFT JOIN store_settings s_ns
                 ON s_ns.user_id = ${alias}.user_id AND s_ns.store_id = ${alias}.ebay_account_id
          LEFT JOIN store_settings g_ns
                 ON g_ns.user_id = ${alias}.user_id AND g_ns.is_global = TRUE
      ) r_ns
     WHERE r_ns.days IS NOT NULL
       AND ${alias}.created_at <= NOW() - make_interval(days => r_ns.days)
       AND NOT EXISTS (
         SELECT 1 FROM orders o_ns
          WHERE o_ns.listing_id = ${alias}.id
            AND o_ns.order_date > NOW() - make_interval(days => r_ns.days)
       )
  )`;
}
