/**
 * eBay meters API calls PER APPLICATION, not per seller.
 *
 * Every one of our users draws from the same daily quota, so call volume — not
 * customer count — is what runs out, and when it does eBay starts refusing
 * calls for everyone at once. The ceilings differ by three orders of magnitude
 * between resources (Inventory 2,000,000/day vs Taxonomy 5,000/day), so a
 * single global counter would be useless: the budget has to be tracked per
 * resource.
 *
 * Source: https://developer.ebay.com/develop/apis/api-call-limits
 */

/** The eBay APIs we spend budget against, named as eBay meters them. */
export enum EbayApiResource {
  /** Listing writes: inventory items, offers, publish, price/quantity. */
  INVENTORY = 'sell.inventory',
  /** Category suggestions + item-aspect metadata. The scarcest resource we use. */
  TAXONOMY = 'commerce.taxonomy',
  /** Business policies, fulfillment/payment/return profiles. */
  ACCOUNT = 'sell.account',
  /** Order retrieval and shipping fulfillment. */
  FULFILLMENT = 'sell.fulfillment',
  /** Legacy XML calls (store discovery, EndItem). */
  TRADING = 'trading',
  /**
   * Bulk report tasks (create → poll → download).
   *
   * 100,000/day, 20x Trading's ceiling, and the reason periodic listing
   * reconciliation is affordable at all: one report covers a seller's ENTIRE
   * catalogue, so the cost is per seller rather than per 200 listings the way
   * `GetMyeBaySelling` is.
   *
   * Note eBay meters feed TASKS separately from these calls (errors 160024 and
   * 160025 — concurrent, and per hour/day). eBay publishes no figure for
   * either, so a sweep has to be paced and must treat both as live limits
   * rather than assuming this daily ceiling is the only one.
   */
  FEED = 'sell.feed',
  /** Rate-limit introspection itself. */
  ANALYTICS = 'developer.analytics',
}

/**
 * Who the call is for.
 *
 * Background work (the Keepa refresh fan-out, bulk creates) is throttled
 * against a reduced ceiling so it can never consume the last of the quota; a
 * seller clicking "publish" still has budget left. Without this split, one
 * refresh cycle could lock every user out of interactive listing actions for
 * the rest of the day.
 */
export enum EbayCallPriority {
  INTERACTIVE = 'interactive',
  BACKGROUND = 'background',
}

/** Live utilization for one resource, as shown in the admin panel. */
export interface EbayCallBudgetStatusDto {
  resource: EbayApiResource;
  /** Full daily ceiling. */
  limit: number;
  used: number;
  remaining: number;
  /** Ceiling background work is held to (limit minus the interactive reserve). */
  backgroundLimit: number;
  /** ISO timestamp at which the counter resets. */
  resetAt: string;
  /** True when eBay's own Analytics API confirmed this ceiling, false when it is a configured default. */
  observed: boolean;
}
