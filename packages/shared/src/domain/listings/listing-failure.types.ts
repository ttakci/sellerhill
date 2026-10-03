import type { ListingRuleKind } from '../store-settings/listing-rules';

/**
 * Why a listing could not be created.
 *
 * Exists so the UI can say something actionable instead of rendering eBay's raw
 * error string. Every value maps to one localized message and a decision about
 * whether retrying can possibly help.
 */
export enum ListingFailureCode {
  /** The ASIN is already listed or drafted for this user. */
  DUPLICATE_LISTING = 'duplicate_listing',
  /**
   * eBay itself reports the seller already has an identical item live
   * (errorId 25002), for a listing our own DB has no record of — e.g. a stray
   * listing from earlier manual/sandbox testing. Distinct from
   * `DUPLICATE_LISTING`, which is our own local pre-check against this user's
   * tracked listings; this one is eBay's answer, not ours.
   */
  EBAY_DUPLICATE_ITEM = 'ebay_duplicate_item',
  /** Amazon stock is below the group's buffer, so quantity resolved to 0. */
  ZERO_STOCK = 'zero_stock',
  /** Plan limit reached (listing or monthly automatic orders). */
  QUOTA_EXHAUSTED = 'quota_exhausted',
  /**
   * The identifier does not resolve to a real product — either it never had a
   * valid ASIN shape (10 alphanumeric characters) or the provider has no data
   * for it. Terminal: retrying the same input cannot succeed.
   */
  ASIN_NOT_FOUND = 'asin_not_found',
  /** Keepa returned nothing usable for the ASIN. */
  PRODUCT_DATA_UNAVAILABLE = 'product_data_unavailable',
  /**
   * The Amazon price could not be read (or read as 0), so a live listing would
   * be priced from nothing. Terminal for that attempt: the seller re-adds the
   * ASIN once the page shows a price. A draft may still be saved.
   */
  SOURCE_PRICE_UNAVAILABLE = 'source_price_unavailable',
  /**
   * Amazon shows no Buy Box for the ASIN — only "See All Buying Options".
   * There is no single offer to price from or to buy through (auto-fulfill
   * adds the Buy Box offer to the cart), so the listing cannot be automated.
   * Terminal: a retry cannot create a Buy Box; the seller re-adds the ASIN if
   * Amazon shows one again.
   */
  NO_BUY_BOX = 'no_buy_box',
  /** eBay's taxonomy could not name a listable leaf category. */
  CATEGORY_UNRESOLVED = 'category_unresolved',
  /** Category aspect metadata is unavailable and nothing was cached. */
  CATEGORY_ASPECTS_UNAVAILABLE = 'category_aspects_unavailable',
  /** eBay demanded an item specific we could not fill (should trend to zero). */
  ASPECT_MISSING = 'aspect_missing',
  /** eBay refused a value we supplied for an item specific. */
  ASPECT_REJECTED = 'aspect_rejected',
  /** UPC/EAN/MPN rejected by eBay. */
  INVALID_IDENTIFIER = 'invalid_identifier',
  /** Images missing or rejected. */
  IMAGE_INVALID = 'image_invalid',
  /** Payment/shipping/return policy missing or not valid for the marketplace. */
  EBAY_POLICY_MISSING = 'ebay_policy_missing',
  /** The eBay account is disconnected or its token was revoked. */
  EBAY_AUTH = 'ebay_auth',
  /** eBay rate-limited us. */
  EBAY_RATE_LIMITED = 'ebay_rate_limited',
  /** eBay was unavailable (5xx) or the publish never returned a listing id. */
  EBAY_UNAVAILABLE = 'ebay_unavailable',
  /** The item or category is restricted for this seller. */
  EBAY_RESTRICTED_ITEM = 'ebay_restricted_item',
  /**
   * The platform's shared daily eBay API quota ran out.
   *
   * Not the seller's fault and not a defect in their listing: eBay meters calls
   * per application, so this is a queue that will drain at the next UTC reset.
   * The item is deferred, never marked permanently failed.
   */
  PROVIDER_BUDGET_EXHAUSTED = 'provider_budget_exhausted',
  /**
   * The seller's own Store Settings blacklist matched the title or description.
   *
   * Entirely self-inflicted and entirely fixable, so it must never be reported
   * as "unknown": the seller can edit the keyword or the listing template. The
   * matched keyword travels in `blacklistedKeyword`.
   */
  BLACKLISTED_KEYWORD = 'blacklisted_keyword',
  /**
   * One of the seller's own listing rules refused the product: a blocked
   * ASIN, VeRO protection, the price range, "shipped by Amazon only" or a
   * rating / review minimum. Which one travels in `listingRule`.
   */
  BLOCKED_BY_RULE = 'blocked_by_rule',
  /**
   * The seller stopped the job before this ASIN was reached.
   *
   * Not a defect in the product or in our pipeline — it never ran.
   */
  CANCELLED = 'cancelled',
  /** Anything not yet classified — carries the raw message. */
  UNKNOWN = 'unknown',
}

export interface ListingFailureDetails {
  /** Item specifics involved (missing or rejected). */
  aspectNames?: string[];
  categoryId?: string;
  categoryName?: string;
  ebayErrorIds?: number[];
  /** The Store Settings keyword that rejected the listing. */
  blacklistedKeyword?: string;
  /** Which listing rule refused the product (`BLOCKED_BY_RULE`). */
  listingRule?: ListingRuleKind;
  /** The product's own figure for that rule (price, rating, rating count). */
  ruleActual?: number | null;
  /** The seller's limit it was compared with. */
  ruleLimit?: number;
  /**
   * Trace id for this attempt, shown to the seller as a reference.
   *
   * It is the same correlation id already threaded through HTTP → queue →
   * worker logs and `queue_observations`, so a support case quoting it can be
   * traced end-to-end instead of being reconstructed from a timestamp and an
   * ASIN. Safe to expose: an opaque `req_<uuid>` that identifies a request, not
   * a user or a resource.
   */
  correlationId?: string;
  /** False when retrying the same input cannot succeed. */
  retryable?: boolean;
  /** Amazon stock at zero-stock failure time (ZERO_STOCK). */
  amazonStock?: number;
  /** True when `amazonStock` is a floor ("at least this many"), not an exact count. */
  amazonStockAtLeast?: boolean;
  /** The listing settings group's stock buffer that pushed quantity to zero. */
  stockBuffer?: number;
}

/**
 * Failure codes where re-running the SAME input can still succeed.
 *
 * There is no seller-facing retry action (removed 2026-08-09 — eBay's quota is
 * metered per application and shared by every seller, so re-attempting the case
 * least likely to succeed spends a common resource). This list now drives the
 * WORKER's decision: `ListingProcessorService` only lets BullMQ retry a job
 * whose failure is in this set, because everything else is a rejection of the
 * input itself and would re-pay Keepa, the LLM rewrite and the publish sequence
 * for a guaranteed second refusal.
 *
 * Transient provider faults are absent on purpose: 429/5xx are already retried
 * four times inside `withEbayRateLimitRetry` before a failure is classified at
 * all, so by this point they are no longer transient.
 */
export const RETRYABLE_LISTING_FAILURE_CODES: ReadonlyArray<ListingFailureCode> = [
  ListingFailureCode.EBAY_RATE_LIMITED,
  ListingFailureCode.EBAY_UNAVAILABLE,
  ListingFailureCode.CATEGORY_ASPECTS_UNAVAILABLE,
  ListingFailureCode.PRODUCT_DATA_UNAVAILABLE,
  ListingFailureCode.ZERO_STOCK,
  ListingFailureCode.PROVIDER_BUDGET_EXHAUSTED,
  ListingFailureCode.UNKNOWN,
];

/**
 * Failures the seller causes and already sees explained on their own screen:
 * their blacklist, an ASIN they already listed, a quantity their own buffer
 * drove to 0, their plan limit, their cancel. None carries provider text and an
 * operator can do nothing about any of them, so the operator's Listing
 * Failures panel leaves them out unless one is asked for explicitly.
 */
export const SELLER_CAUSED_LISTING_FAILURE_CODES: ReadonlyArray<ListingFailureCode> = [
  ListingFailureCode.BLACKLISTED_KEYWORD,
  ListingFailureCode.BLOCKED_BY_RULE,
  ListingFailureCode.DUPLICATE_LISTING,
  ListingFailureCode.ZERO_STOCK,
  ListingFailureCode.QUOTA_EXHAUSTED,
  ListingFailureCode.CANCELLED,
];

export function isRetryableListingFailure(code: ListingFailureCode | undefined | null): boolean {
  return code !== null && code !== undefined && RETRYABLE_LISTING_FAILURE_CODES.includes(code);
}
