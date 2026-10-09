/**
 * Pure filtering over one Best Sellers page. The page is at most 50 products
 * that are already in the browser, so filtering happens here rather than on
 * the server — and the products it hides were still VIEWED as far as the
 * allowance is concerned (the server counts the page, not what survives a
 * filter).
 */
import type { BestSellersItemDto } from '@repo/shared';

import type { BestSellersFilterCriteria, BestSellersFilterValues } from '../bestSellers.types';

/** Star thresholds offered in the rating filter; `''` is "any rating". */
export const BEST_SELLERS_RATING_OPTIONS: readonly string[] = ['', '3', '3.5', '4', '4.5'];

export const EMPTY_BEST_SELLERS_FILTERS: BestSellersFilterValues = {
  search: '',
  minRating: '',
  minReviews: '',
  priceMin: '',
  priceMax: '',
};

/** A typed value as a non-negative number, or null when blank / not a number. */
export function parseFilterNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function toBestSellersFilterCriteria(values: BestSellersFilterValues): BestSellersFilterCriteria {
  const search = values.search.trim().toLowerCase();
  return {
    search: search === '' ? null : search,
    minRating: parseFilterNumber(values.minRating),
    minReviews: parseFilterNumber(values.minReviews),
    priceMin: parseFilterNumber(values.priceMin),
    priceMax: parseFilterNumber(values.priceMax),
  };
}

export function hasActiveBestSellersFilters(criteria: BestSellersFilterCriteria): boolean {
  return (
    criteria.search !== null ||
    criteria.minRating !== null ||
    criteria.minReviews !== null ||
    criteria.priceMin !== null ||
    criteria.priceMax !== null
  );
}

/**
 * Whether one product passes every active constraint. A product that lacks the
 * field a constraint reads (no rating yet, no readable price) fails that
 * constraint: an unknown value is not evidence that it clears the bar.
 */
export function matchesBestSellersFilters(item: BestSellersItemDto, criteria: BestSellersFilterCriteria): boolean {
  const average = item.rating?.average ?? null;
  const reviews = item.rating?.count ?? null;
  const price = item.price?.amount ?? null;

  if (
    criteria.search !== null &&
    !(item.title ?? '').toLowerCase().includes(criteria.search) &&
    !item.asin.toLowerCase().includes(criteria.search)
  ) {
    return false;
  }

  if (criteria.minRating !== null && (average === null || average < criteria.minRating)) {
    return false;
  }
  if (criteria.minReviews !== null && (reviews === null || reviews < criteria.minReviews)) {
    return false;
  }
  if (criteria.priceMin !== null && (price === null || price < criteria.priceMin)) {
    return false;
  }
  if (criteria.priceMax !== null && (price === null || price > criteria.priceMax)) {
    return false;
  }
  return true;
}
