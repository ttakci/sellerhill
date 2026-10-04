import { ListingAutoEndReason } from '@repo/shared';

/** The clean-up rules a SQL statement may read from a listing's group. */
export type GroupRuleField = 'outOfStockEndDays' | 'coldListingDays' | 'coldListingAutoEnd';

const GROUP_RULE_TYPE: Record<GroupRuleField, 'int' | 'boolean'> = {
  outOfStockEndDays: 'int',
  coldListingDays: 'int',
  coldListingAutoEnd: 'boolean',
};

/**
 * One rule of the listing's OWN settings group, as a typed SQL expression —
 * listing rules live on the group (migration 141), so each listing is judged
 * by the group it was published with. Stored rules are always normalized
 * (`normalizeListingRules`), so the value is a valid day count / boolean or
 * NULL (rule off, group without rules, or listing without a group).
 *
 * `alias` is a fixed table alias at every call site and `field` a literal
 * union, so nothing caller-controlled is interpolated.
 */
export function buildGroupRuleSql(alias: string, field: GroupRuleField): string {
  return `(SELECT (gr.listing_rules->>'${field}')::${GROUP_RULE_TYPE[field]} FROM listing_settings_groups gr WHERE gr.id = ${alias}.listing_settings_group_id)`;
}

/**
 * Candidate query for one clean-up reason. The two share every safety
 * condition and differ only in what makes a listing "due":
 *
 *  - only ACTIVE listings with an eBay offer id (the Inventory API route —
 *    a legacy listing without one is left for the seller);
 *  - never a listing the seller PAUSED on purpose (`disable_ordering`, or a
 *    quantity locked at 0): its 0 is a decision, not a stock-out;
 *  - not one eBay refused to end within the last day;
 *  - the day count is read per listing from its own group; a group with the
 *    rule off (NULL) makes nothing due. Ending a not-selling listing also
 *    needs the group's second switch (`coldListingAutoEnd`) — watching alone
 *    only flags it.
 *
 * `$1` user, `$2` store, `$3` limit.
 */
export function buildCleanupCandidateSql(reason: ListingAutoEndReason): string {
  let due: string;
  if (reason === ListingAutoEndReason.OUT_OF_STOCK) {
    const days = buildGroupRuleSql('l', 'outOfStockEndDays');
    due = `l.quantity <= 0
         AND l.quantity_zero_since IS NOT NULL
         AND ${days} IS NOT NULL
         AND l.quantity_zero_since <= NOW() - make_interval(days => ${days})
         AND l.disable_ordering = FALSE
         AND NOT (l.lock_quantity = TRUE AND COALESCE(l.quantity_override, 0) <= 0)`;
  } else {
    const days = buildGroupRuleSql('l', 'coldListingDays');
    due = `COALESCE(${buildGroupRuleSql('l', 'coldListingAutoEnd')}, FALSE)
         AND ${days} IS NOT NULL
         AND l.created_at <= NOW() - make_interval(days => ${days})
         AND NOT EXISTS (
           SELECT 1 FROM orders o
            WHERE o.listing_id = l.id
              AND o.order_date > NOW() - make_interval(days => ${days})
         )`;
  }
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
     LIMIT $3::int`;
}

/**
 * "This listing is not selling", by the seller's own window — the ONE
 * predicate behind the Action Center's not-selling item and the listings
 * filter it links to, so the count and the list can never disagree.
 *
 * The window is read per listing from its own settings group
 * (`coldListingDays`). A group that is not watching (NULL) matches nothing.
 *
 * Counted from the listing's creation when it never sold, so a listing younger
 * than the window is never called slow.
 */
export function buildNotSellingSql(alias: string): string {
  return `EXISTS (
    SELECT 1
      FROM (SELECT ${buildGroupRuleSql(alias, 'coldListingDays')} AS days) r_ns
     WHERE r_ns.days IS NOT NULL
       AND ${alias}.created_at <= NOW() - make_interval(days => r_ns.days)
       AND NOT EXISTS (
         SELECT 1 FROM orders o_ns
          WHERE o_ns.listing_id = ${alias}.id
            AND o_ns.order_date > NOW() - make_interval(days => r_ns.days)
       )
  )`;
}
