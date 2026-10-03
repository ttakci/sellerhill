/**
 * Listing rules — what a seller refuses to list, decided BEFORE anything is
 * sent to eBay (`store_settings.listing_rules` JSONB, migration 138).
 *
 * Everything here is pure: the create worker resolves the rules once per batch
 * and calls `evaluateListingRules` per ASIN. A refusal is the seller's own
 * setting, so it is reported with the rule that fired and the figures behind
 * it — never as a generic failure.
 */

/** Which rule refused an ASIN. Stored on the job item's failure details. */
export enum ListingRuleKind {
  /** The ASIN is on the seller's own blocked-ASIN list. */
  BLOCKED_ASIN = 'blocked_asin',
  /** The product's brand is on the platform's VeRO list (never shown to sellers). */
  VERO_BRAND = 'vero_brand',
  PRICE_BELOW_MIN = 'price_below_min',
  PRICE_ABOVE_MAX = 'price_above_max',
  /** Not shipped by Amazon itself, or the page did not say who ships it. */
  NOT_SHIPPED_BY_AMAZON = 'not_shipped_by_amazon',
  LOW_RATING = 'low_rating',
  LOW_REVIEW_COUNT = 'low_review_count',
}

/**
 * What the source page said about the offer and its reputation, captured on a
 * full (create) fetch. `null` inside means the page was read and carried no
 * such value (a product with no ratings yet); an ABSENT object on
 * `ProductData` means the provider never captured it (Keepa, or a row saved
 * before this existed) — rules that need it then pass rather than guess.
 */
export interface SourceQuality {
  rating: number | null;
  ratingCount: number | null;
  isPrime: boolean | null;
  soldByAmazon: boolean | null;
  shippedByAmazon: boolean | null;
}

export interface ListingRulesConfig {
  /** Check the brand against the platform's VeRO list. On unless switched off. */
  veroProtectionEnabled: boolean;
  /**
   * Send no brand to eBay: the Brand aspect reads eBay's own "Does not apply",
   * the Brand / Manufacturer specifics are dropped and no UPC / EAN / MPN is
   * sent (a barcode would let eBay's catalog put the brand straight back).
   * ON unless switched off (operator decision, 2026-10-03): a seller who wants
   * the brand on eBay turns it off.
   */
  hideBrand: boolean;
  /** ASINs the seller never wants listed, uppercase. */
  blockedAsins: string[];
  /** Amazon price bounds for a new listing; null = no bound. */
  minSourcePrice: number | null;
  maxSourcePrice: number | null;
  /** Only list offers Amazon itself ships. */
  amazonShippedOnly: boolean;
  /** Minimum star rating (1–5); null = no minimum. */
  minRating: number | null;
  /** Minimum number of ratings; null = no minimum. */
  minReviewCount: number | null;
  /**
   * End a live listing on eBay once it has been at quantity 0 for this many
   * days in a row; null = never (the default). The count restarts whenever the
   * listing has stock again.
   */
  outOfStockEndDays: number | null;
  /**
   * A listing with no sale for this many days counts as "not selling" (counted
   * from its creation when it never sold); null = not watched.
   */
  coldListingDays: number | null;
  /** End not-selling listings on eBay automatically instead of only flagging them. */
  coldListingAutoEnd: boolean;
  /**
   * Promoted Listings ad rate (percent of the sale price, eBay's
   * `bidPercentage`) for every new listing; null = do not promote. eBay charges
   * it only when an item sells through the ad — and only runs the ad at all
   * for a seller it considers eligible.
   */
  promotedAdRate: number | null;
}

/** eBay: "a minimum value of 2.0 and a maximum value of 100.0", one decimal. */
export const PROMOTED_AD_RATE_MIN = 2;
export const PROMOTED_AD_RATE_MAX = 100;
export const DEFAULT_PROMOTED_AD_RATE = 5;

export const LISTING_CLEANUP_MIN_DAYS = 1;
export const LISTING_CLEANUP_MAX_DAYS = 365;
/** A not-selling window shorter than this would end a listing before it had a fair chance. */
export const COLD_LISTING_MIN_DAYS = 14;
export const DEFAULT_COLD_LISTING_DAYS = 90;

export const DEFAULT_LISTING_RULES: Readonly<ListingRulesConfig> = Object.freeze({
  veroProtectionEnabled: true,
  hideBrand: true,
  blockedAsins: [],
  minSourcePrice: null,
  maxSourcePrice: null,
  amazonShippedOnly: false,
  minRating: null,
  minReviewCount: null,
  outOfStockEndDays: null,
  coldListingDays: null,
  coldListingAutoEnd: false,
  promotedAdRate: null,
});

export const LISTING_RULES_MAX_BLOCKED_ASINS = 5000;
export const LISTING_RULES_MAX_PRICE = 100000;

const BLOCKED_ASIN_SHAPE = /^[A-Z0-9]{10}$/;

function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }
  return value;
}

/** Split free text (commas, whitespace, new lines) into unique well-formed ASINs. */
export function parseBlockedAsins(input: string | readonly string[]): string[] {
  const tokens = typeof input === 'string' ? input.split(/[\s,;]+/) : input;
  const seen = new Set<string>();
  for (const token of tokens) {
    const asin = String(token).trim().toUpperCase();
    if (BLOCKED_ASIN_SHAPE.test(asin)) {
      seen.add(asin);
    }
  }
  return [...seen].slice(0, LISTING_RULES_MAX_BLOCKED_ASINS);
}

/**
 * Read a stored (or submitted) rules object. Total: anything missing or
 * malformed falls back to the default for that field, so a row written by an
 * older build — or NULL — is simply "defaults".
 */
export function normalizeListingRules(raw: unknown): ListingRulesConfig {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const minSourcePrice = boundedNumber(source.minSourcePrice, 0, LISTING_RULES_MAX_PRICE);
  let maxSourcePrice = boundedNumber(source.maxSourcePrice, 0, LISTING_RULES_MAX_PRICE);
  // A maximum below the minimum would refuse every product; drop the maximum.
  if (minSourcePrice !== null && maxSourcePrice !== null && maxSourcePrice < minSourcePrice) {
    maxSourcePrice = null;
  }
  const minReviewCount = boundedNumber(source.minReviewCount, 1, 1_000_000);
  const outOfStockEndDays = boundedNumber(source.outOfStockEndDays, LISTING_CLEANUP_MIN_DAYS, LISTING_CLEANUP_MAX_DAYS);
  const coldListingDays = boundedNumber(source.coldListingDays, COLD_LISTING_MIN_DAYS, LISTING_CLEANUP_MAX_DAYS);
  const promotedAdRate = boundedNumber(source.promotedAdRate, PROMOTED_AD_RATE_MIN, PROMOTED_AD_RATE_MAX);
  return {
    veroProtectionEnabled: source.veroProtectionEnabled !== false,
    hideBrand: source.hideBrand !== false,
    blockedAsins: Array.isArray(source.blockedAsins) ? parseBlockedAsins(source.blockedAsins as string[]) : [],
    minSourcePrice: minSourcePrice !== null && minSourcePrice > 0 ? minSourcePrice : null,
    maxSourcePrice: maxSourcePrice !== null && maxSourcePrice > 0 ? maxSourcePrice : null,
    amazonShippedOnly: source.amazonShippedOnly === true,
    minRating: boundedNumber(source.minRating, 1, 5),
    minReviewCount: minReviewCount !== null ? Math.floor(minReviewCount) : null,
    outOfStockEndDays: outOfStockEndDays !== null ? Math.floor(outOfStockEndDays) : null,
    coldListingDays: coldListingDays !== null ? Math.floor(coldListingDays) : null,
    // Ending automatically is meaningless (and dangerous to leave set) while
    // nothing is being watched.
    coldListingAutoEnd: coldListingDays !== null && source.coldListingAutoEnd === true,
    // eBay accepts one decimal only (5.5, never 5.55).
    promotedAdRate: promotedAdRate !== null ? Math.round(promotedAdRate * 10) / 10 : null,
  };
}

export interface ListingRuleViolation {
  kind: ListingRuleKind;
  /** The product's own figure (price, rating, rating count), when one exists. */
  actual?: number | null;
  /** The seller's limit the figure was compared with. */
  limit?: number;
}

export interface ListingRuleSubject {
  asin: string;
  /** Amazon price; 0 or less means unknown and is never compared. */
  price: number;
  sourceQuality?: SourceQuality;
}

/** True when the seller's own list names this ASIN. Needs no product data. */
export function isAsinBlocked(rules: Pick<ListingRulesConfig, 'blockedAsins'>, asin: string): boolean {
  return rules.blockedAsins.includes(asin.trim().toUpperCase());
}

/**
 * The first rule that refuses this product, or null. Order is cheapest and
 * most specific first, so the reason shown is the one the seller can act on.
 */
export function evaluateListingRules(
  rules: ListingRulesConfig,
  subject: ListingRuleSubject
): ListingRuleViolation | null {
  if (isAsinBlocked(rules, subject.asin)) {
    return { kind: ListingRuleKind.BLOCKED_ASIN };
  }

  const price = Number(subject.price);
  if (Number.isFinite(price) && price > 0) {
    if (rules.minSourcePrice !== null && price < rules.minSourcePrice) {
      return { kind: ListingRuleKind.PRICE_BELOW_MIN, actual: price, limit: rules.minSourcePrice };
    }
    if (rules.maxSourcePrice !== null && price > rules.maxSourcePrice) {
      return { kind: ListingRuleKind.PRICE_ABOVE_MAX, actual: price, limit: rules.maxSourcePrice };
    }
  }

  // Never captured (Keepa, or a cached row from before this existed): nothing
  // to judge, and refusing every such product would stop listing altogether.
  const quality = subject.sourceQuality;
  if (!quality) {
    return null;
  }

  if (rules.amazonShippedOnly && quality.shippedByAmazon !== true) {
    return { kind: ListingRuleKind.NOT_SHIPPED_BY_AMAZON };
  }
  if (rules.minRating !== null && !(quality.rating !== null && quality.rating >= rules.minRating)) {
    return { kind: ListingRuleKind.LOW_RATING, actual: quality.rating, limit: rules.minRating };
  }
  if (
    rules.minReviewCount !== null &&
    !(quality.ratingCount !== null && quality.ratingCount >= rules.minReviewCount)
  ) {
    return { kind: ListingRuleKind.LOW_REVIEW_COUNT, actual: quality.ratingCount ?? 0, limit: rules.minReviewCount };
  }
  return null;
}

/**
 * Store > Global, with the loss limit's inheritance rule: a store row that
 * never saved rules (a focused drawer created it) inherits the global ones
 * instead of silently dropping a filter set for every store.
 */
export function resolveListingRules(storeRules: unknown, globalRules: unknown): ListingRulesConfig {
  return normalizeListingRules(storeRules ?? globalRules);
}
