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
  /** Amazon stock is below the group's buffer, so quantity resolved to 0. */
  ZERO_STOCK = 'zero_stock',
  /** Plan limit reached (listing or monthly automatic orders). */
  QUOTA_EXHAUSTED = 'quota_exhausted',
  /** Keepa returned nothing usable for the ASIN. */
  PRODUCT_DATA_UNAVAILABLE = 'product_data_unavailable',
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
  /** Anything not yet classified — carries the raw message. */
  UNKNOWN = 'unknown',
}

export interface ListingFailureDetails {
  /** Item specifics involved (missing or rejected). */
  aspectNames?: string[];
  categoryId?: string;
  categoryName?: string;
  ebayErrorIds?: number[];
  /** False when retrying the same input cannot succeed. */
  retryable?: boolean;
}

/** Failure codes where a plain retry is worth offering. */
export const RETRYABLE_LISTING_FAILURE_CODES: ReadonlyArray<ListingFailureCode> = [
  ListingFailureCode.EBAY_RATE_LIMITED,
  ListingFailureCode.EBAY_UNAVAILABLE,
  ListingFailureCode.CATEGORY_ASPECTS_UNAVAILABLE,
  ListingFailureCode.PRODUCT_DATA_UNAVAILABLE,
  ListingFailureCode.ZERO_STOCK,
  ListingFailureCode.UNKNOWN,
];

export function isRetryableListingFailure(code: ListingFailureCode | undefined | null): boolean {
  return code !== null && code !== undefined && RETRYABLE_LISTING_FAILURE_CODES.includes(code);
}
