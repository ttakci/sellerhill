import {
  COLD_LISTING_MIN_DAYS,
  DEFAULT_COLD_LISTING_DAYS,
  LISTING_CLEANUP_MAX_DAYS,
  normalizeMinRating,
  type ListingRulesConfig,
} from '@repo/shared';

import { ColdListingMode, ListingRulesDraftError, type ListingRulesDraft } from './ListingGroupDrawer.types';

const NONE = '';

/** A number input's text → a positive number, or null for blank / unusable. */
const toPositiveNumber = (text: string): number | null => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
};

const numberToText = (value: number | null): string => (value === null ? NONE : String(value));

/** A group's stored rules (always normalized by the API) as the Rules step's text fields. */
export const toListingRulesDraft = (rules: ListingRulesConfig): ListingRulesDraft => ({
  veroProtectionEnabled: rules.veroProtectionEnabled,
  hideBrand: rules.hideBrand,
  minPrice: numberToText(rules.minSourcePrice),
  maxPrice: numberToText(rules.maxSourcePrice),
  amazonShippedOnly: rules.amazonShippedOnly,
  minRating: numberToText(rules.minRating),
  minReviewCount: numberToText(rules.minReviewCount),
  outOfStockEndDays: numberToText(rules.outOfStockEndDays),
  coldListingEnabled: rules.coldListingDays !== null,
  coldListingDays: String(rules.coldListingDays ?? DEFAULT_COLD_LISTING_DAYS),
  coldListingMode: rules.coldListingAutoEnd ? ColdListingMode.END : ColdListingMode.FLAG,
});

const coldDaysOf = (draft: ListingRulesDraft): number => Number(draft.coldListingDays);

/**
 * The first field that refuses its value, or null. A blank rating is "off";
 * a typed one must be 1.0–5.0 (comma or point decimal).
 */
export const listingRulesDraftError = (draft: ListingRulesDraft): ListingRulesDraftError | null => {
  if (draft.minRating.trim() !== '' && normalizeMinRating(draft.minRating) === null) {
    return ListingRulesDraftError.MIN_RATING;
  }
  const minPrice = toPositiveNumber(draft.minPrice);
  const maxPrice = toPositiveNumber(draft.maxPrice);
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
    return ListingRulesDraftError.PRICE;
  }
  const coldDays = coldDaysOf(draft);
  if (
    draft.coldListingEnabled &&
    !(Number.isInteger(coldDays) && coldDays >= COLD_LISTING_MIN_DAYS && coldDays <= LISTING_CLEANUP_MAX_DAYS)
  ) {
    return ListingRulesDraftError.COLD_DAYS;
  }
  return null;
};

/** The draft as the rules sent to the API (which normalizes them again). */
export const fromListingRulesDraft = (draft: ListingRulesDraft): ListingRulesConfig => {
  const reviewCount = toPositiveNumber(draft.minReviewCount);
  return {
    veroProtectionEnabled: draft.veroProtectionEnabled,
    hideBrand: draft.hideBrand,
    minSourcePrice: toPositiveNumber(draft.minPrice),
    maxSourcePrice: toPositiveNumber(draft.maxPrice),
    amazonShippedOnly: draft.amazonShippedOnly,
    minRating: normalizeMinRating(draft.minRating),
    minReviewCount: reviewCount === null ? null : Math.floor(reviewCount),
    outOfStockEndDays: toPositiveNumber(draft.outOfStockEndDays),
    coldListingDays: draft.coldListingEnabled ? coldDaysOf(draft) : null,
    coldListingAutoEnd: draft.coldListingEnabled && draft.coldListingMode === ColdListingMode.END,
  };
};
