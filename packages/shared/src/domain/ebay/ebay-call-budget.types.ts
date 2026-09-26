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
  /**
   * Trading `GetMyeBaySelling` — existing-listing discovery on import.
   *
   * eBay meters Trading PER METHOD (AddItem 100,000/day, GetMyeBaySelling
   * 5,000/day, …), so every Trading method we call is its own resource. Adding
   * a Trading call means adding a member here and a row in `RESOURCE_SOURCE`;
   * `trading-methods.guard.spec.ts` fails until both exist.
   */
  TRADING_GET_MY_EBAY_SELLING = 'trading.GetMyeBaySelling',
  /** Trading `EndItem` — ending a listing. */
  TRADING_END_ITEM = 'trading.EndItem',
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

/** One rate window eBay reports for a resource. A resource may report several. */
export interface EbayRateWindowDto {
  limit: number;
  remaining: number;
  /** Window length in seconds. A "day" is not always exactly 86400. */
  timeWindowSeconds: number;
  /** When eBay's own window resets — NOT UTC midnight in general. */
  resetAt: string | null;
}

/** One resource exactly as eBay's `getRateLimits` reports it, flattened. */
export interface EbayRateLimitResourceDto {
  apiContext: string;
  apiName: string;
  apiVersion: string;
  resourceName: string;
  /** Empty when eBay reports no rate at all (e.g. the Media API image resource). */
  windows: EbayRateWindowDto[];
}

/**
 * One governed resource in the admin panel: eBay's figure beside our counter.
 *
 * The two are deliberately never subtracted. eBay's day resets at its own time
 * and ours at UTC midnight, so a difference would be meaningless — the operator
 * compares them by eye, and a large mismatch means some caller bypasses the
 * governor.
 */
export interface EbayBudgetResourceRowDto {
  resource: EbayApiResource;
  /** eBay's daily ceiling; null when eBay reported none — the governor then does not gate. */
  ebayLimit: number | null;
  ebayRemaining: number | null;
  ebayResetAt: string | null;
  /** eBay resource names this row was derived from. */
  sourceResources: string[];
  /** True when the row stands for part of what eBay meters (Trading). */
  partial: boolean;
  /** Sub-daily windows eBay also enforces on the same source. */
  otherWindows: EbayRateWindowDto[];
  /** Calls our governor counted today (UTC). */
  ourCount: number;
  /** Ceiling background work is held to; null when there is no eBay ceiling. */
  backgroundLimit: number | null;
  /** When our counter resets (UTC midnight). */
  ourResetAt: string;
}

/** `GET /v1/admin/ebay/budget`. */
export interface EbayBudgetOverviewDto {
  /** When eBay's figures were captured; null when eBay has never answered. */
  fetchedAt: string | null;
  /** False when the latest fetch failed and a stored snapshot is being shown. */
  live: boolean;
  rows: EbayBudgetResourceRowDto[];
  /** Everything eBay reports that no governed resource uses — shown, never hidden. */
  unmapped: EbayRateLimitResourceDto[];
}
