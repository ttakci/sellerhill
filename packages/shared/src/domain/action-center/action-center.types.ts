/**
 * Action Center — the seller's "what must I do right now" surface.
 *
 * The rest of the app answers "what happened" (dashboard, lists). Nothing
 * answered "what is waiting on ME", so a blocked purchase, a revoked store
 * token or an exhausted plan slot were only discoverable by opening the right
 * list with the right filter already in mind.
 *
 * Design rules, all load-bearing:
 *
 *  1. **An item exists only when the seller can act on it.** Anything the
 *     platform resolves by itself (a queued job, a pending refresh) belongs on
 *     the dashboard, not here. A list that reports things you cannot fix stops
 *     being read, and then the things you CAN fix are lost with it.
 *  2. **The API sends codes, never sentences.** `key` / `breakdown[].code` are
 *     enum values; every user-visible string is resolved from i18n on the web
 *     side. Same split as `ListingFailureCode` — and the same reason: the
 *     backend has no locale, and a provider's or a column's wording is not
 *     seller-facing copy.
 *  3. **Counts are always real counts.** An item with `count === 0` is omitted
 *     entirely rather than rendered as an empty row, so the total badge equals
 *     the number of things actually waiting.
 *  4. **Severity is about consequence, not about which table it came from** —
 *     see {@link ActionCenterSeverity}.
 */

/**
 * How bad it is if the seller does nothing.
 *
 * Deliberately consequence-based, so unrelated subsystems stay comparable:
 * an Amazon-cancelled order and a revoked eBay token are both CRITICAL because
 * both mean money is already at risk, even though one is an order row and the
 * other an account row.
 */
export enum ActionCenterSeverity {
  /** Money is at risk now: a sale is owed, or the platform cannot operate. */
  CRITICAL = 'critical',
  /** Automation is degraded — it still runs, but worse, and it will cost. */
  WARNING = 'warning',
  /** An opportunity or housekeeping. Nothing breaks if it waits. */
  INFO = 'info',
}

/** Rank used to sort and to roll a group's severity up to its worst item. */
export const ACTION_CENTER_SEVERITY_RANK: Record<ActionCenterSeverity, number> = {
  [ActionCenterSeverity.CRITICAL]: 3,
  [ActionCenterSeverity.WARNING]: 2,
  [ActionCenterSeverity.INFO]: 1,
};

/**
 * Sections of the page. One card per group, in this declaration order —
 * which is also priority order: orders first because an unfulfilled sale is
 * the only thing with a buyer waiting on the other end.
 */
export enum ActionCenterGroup {
  ORDERS = 'orders',
  CONNECTIONS = 'connections',
  LISTINGS = 'listings',
  PLAN = 'plan',
  SETUP = 'setup',
}

/** Group render/priority order. */
export const ACTION_CENTER_GROUP_ORDER: readonly ActionCenterGroup[] = [
  ActionCenterGroup.ORDERS,
  ActionCenterGroup.CONNECTIONS,
  ActionCenterGroup.LISTINGS,
  ActionCenterGroup.PLAN,
  ActionCenterGroup.SETUP,
];

/**
 * Every actionable condition the platform can detect.
 *
 * Adding one means: a new value here, one entry in the API's signal manifest,
 * and one i18n block. Nothing else — the page renders whatever it is given.
 */
export enum ActionCenterItemKey {
  /**
   * Amazon cancelled after we paid. The eBay sale is still live and owed to the
   * buyer, so this outranks everything: the seller must re-buy or refund.
   */
  ORDER_AMAZON_CANCELLED = 'order_amazon_cancelled',
  /**
   * Auto-fulfillment stopped fail-closed (captcha, cap, address, stock…).
   * Carries a breakdown by {@link AutoFulfillBlockedReason} — "12 orders
   * blocked" is not actionable, "8 blocked: cap too low" is.
   */
  ORDER_FULFILLMENT_BLOCKED = 'order_fulfillment_blocked',
  /**
   * Nobody has bought the item on Amazon and automation is not going to:
   * no Amazon order, not shipped, and old enough that it is not just in flight.
   */
  ORDER_AWAITING_PURCHASE = 'order_awaiting_purchase',
  /**
   * The sold item's eBay Item ID matches no listing we track, so cost and
   * profit can never be resolved for it. Fixed by importing the listing.
   */
  ORDER_UNTRACKED = 'order_untracked',

  /** An eBay store's OAuth grant is revoked/errored — sync and publishing stop. */
  EBAY_ACCOUNT_DISCONNECTED = 'ebay_account_disconnected',
  /** An Amazon buyer account cannot sign in — auto-fulfillment cannot run on it. */
  AMAZON_ACCOUNT_NEEDS_ATTENTION = 'amazon_account_needs_attention',

  /** Listing-creation items that ended in a terminal error, by failure code. */
  LISTING_JOB_FAILURES = 'listing_job_failures',
  /** Drafts prepared but never published — they cost nothing and sell nothing. */
  LISTING_DRAFTS_PENDING = 'listing_drafts_pending',
  /**
   * Active listings whose source product is quarantined (the ASIN has failed
   * refresh repeatedly — usually delisted). The eBay listing is still live and
   * sellable, which is the dangerous part.
   */
  LISTING_SOURCE_UNAVAILABLE = 'listing_source_unavailable',
  /** Active listings pushed to quantity 0 — live, visible, and unbuyable. */
  LISTING_OUT_OF_STOCK = 'listing_out_of_stock',

  /** Active-listing slots at or near the plan limit. */
  PLAN_LISTING_QUOTA = 'plan_listing_quota',
  /** Monthly automatic-order slots at or near the plan limit. */
  PLAN_AO_QUOTA = 'plan_ao_quota',
  /** Payment failed — access is about to stop. */
  PLAN_PAST_DUE = 'plan_past_due',
  /** Trial ends within the notice window. */
  PLAN_TRIAL_ENDING = 'plan_trial_ending',

  /** No Amazon buyer account exists, so nothing can ever be auto-purchased. */
  SETUP_NO_AMAZON_ACCOUNT = 'setup_no_amazon_account',
  /** Buyer accounts exist but none is cleared for auto-fulfillment. */
  SETUP_AUTO_FULFILL_OFF = 'setup_auto_fulfill_off',
}

/**
 * One reason inside an item's breakdown — e.g. a blocked reason or a listing
 * failure code. `code` is an enum value from the owning domain, localized by
 * the web app; it is never a provider's raw message.
 */
export interface ActionCenterBreakdownEntryDto {
  code: string;
  count: number;
}

/** A single actionable condition, with everything the row needs to render. */
export interface ActionCenterItemDto {
  key: ActionCenterItemKey;
  group: ActionCenterGroup;
  severity: ActionCenterSeverity;
  /** How many things are waiting. Always >= 1 — zero-count items are omitted. */
  count: number;
  /**
   * Interpolation values for the localized description (`{{used}}`, `{{limit}}`,
   * `{{days}}`). Numbers and identifiers only — never prose.
   */
  context?: Record<string, string | number>;
  /** Reasons behind the count, most frequent first. Empty when not applicable. */
  breakdown?: ActionCenterBreakdownEntryDto[];
  /**
   * Where the seller goes to resolve it: a locale-less app path, usually a
   * pre-filtered list (`/orders?fulfillmentState=action_required`). Null when
   * the fix is not a single destination.
   */
  actionPath: string | null;
}

/** A page section — its severity is its worst item's. */
export interface ActionCenterGroupDto {
  key: ActionCenterGroup;
  severity: ActionCenterSeverity;
  /** Number of ITEMS in the group (rows), not the sum of their counts. */
  itemCount: number;
  items: ActionCenterItemDto[];
}

/**
 * `GET /v1/action-center`.
 *
 * The counts are counts of ITEMS (distinct conditions), not of underlying rows:
 * the sidebar badge should read "6 things need you", not "431 orders".
 */
export interface ActionCenterSummaryDto {
  totalCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  groups: ActionCenterGroupDto[];
  /** ISO timestamp the snapshot was computed at. */
  generatedAt: string;
}
