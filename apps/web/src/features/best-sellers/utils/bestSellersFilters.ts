/**
 * Pure filtering over one Best Sellers page. The page is at most 50 products
 * that are already in the browser, so filtering happens here rather than on
 * the server — and the products it hides were still VIEWED as far as the
 * allowance is concerned (the server counts the page, not what survives a
 * filter).
 */
import type { BestSellersItemDto } from '@repo/shared';

import { BestSellersRangeKey, type BestSellersFilterCriteria, type BestSellersFilterValues, type BestSellersRangeCriteria, type BestSellersRangeValue } from '../bestSellers.types';

/** Star thresholds offered in the rating filter; `''` is "any rating". */
export const BEST_SELLERS_RATING_OPTIONS: readonly string[] = ['', '3', '3.5', '4', '4.5'];

/** The advanced section's fields, in the order they are shown. */
export const BEST_SELLERS_RANGE_KEYS: readonly BestSellersRangeKey[] = [
  BestSellersRangeKey.PRICE,
  BestSellersRangeKey.REVIEWS,
  BestSellersRangeKey.RANK,
];

const EMPTY_RANGE: BestSellersRangeValue = { min: '', max: '' };

export const EMPTY_BEST_SELLERS_FILTERS: BestSellersFilterValues = {
  search: '',
  minRating: '',
  ranges: {
    [BestSellersRangeKey.PRICE]: EMPTY_RANGE,
    [BestSellersRangeKey.REVIEWS]: EMPTY_RANGE,
    [BestSellersRangeKey.RANK]: EMPTY_RANGE,
  },
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

const toRangeCriteria = (range: BestSellersRangeValue): BestSellersRangeCriteria => ({
  min: parseFilterNumber(range.min),
  max: parseFilterNumber(range.max),
});

export const isRangeActive = (range: BestSellersRangeCriteria): boolean => range.min !== null || range.max !== null;

export function toBestSellersFilterCriteria(values: BestSellersFilterValues): BestSellersFilterCriteria {
  const search = values.search.trim().toLowerCase();
  return {
    search: search === '' ? null : search,
    minRating: parseFilterNumber(values.minRating),
    ranges: {
      [BestSellersRangeKey.PRICE]: toRangeCriteria(values.ranges[BestSellersRangeKey.PRICE]),
      [BestSellersRangeKey.REVIEWS]: toRangeCriteria(values.ranges[BestSellersRangeKey.REVIEWS]),
      [BestSellersRangeKey.RANK]: toRangeCriteria(values.ranges[BestSellersRangeKey.RANK]),
    },
  };
}

export function hasActiveBestSellersFilters(criteria: BestSellersFilterCriteria): boolean {
  return (
    criteria.search !== null ||
    criteria.minRating !== null ||
    BEST_SELLERS_RANGE_KEYS.some((key) => isRangeActive(criteria.ranges[key]))
  );
}

function readRangeField(item: BestSellersItemDto, key: BestSellersRangeKey): number | null {
  switch (key) {
    case BestSellersRangeKey.PRICE:
      return item.price?.amount ?? null;
    case BestSellersRangeKey.REVIEWS:
      return item.rating?.count ?? null;
    case BestSellersRangeKey.RANK:
    default:
      return item.rank;
  }
}

/** Inclusive on both ends; an unknown value fails any active side of the range. */
function withinRange(value: number | null, range: BestSellersRangeCriteria): boolean {
  if (!isRangeActive(range)) {
    return true;
  }
  if (value === null) {
    return false;
  }
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

/**
 * Whether one product passes every active constraint. A product that lacks the
 * field a constraint reads (no rating yet, no readable price) fails that
 * constraint: an unknown value is not evidence that it clears the bar.
 */
export function matchesBestSellersFilters(item: BestSellersItemDto, criteria: BestSellersFilterCriteria): boolean {
  if (
    criteria.search !== null &&
    !(item.title ?? '').toLowerCase().includes(criteria.search) &&
    !item.asin.toLowerCase().includes(criteria.search)
  ) {
    return false;
  }
  const average = item.rating?.average ?? null;
  if (criteria.minRating !== null && (average === null || average < criteria.minRating)) {
    return false;
  }
  return BEST_SELLERS_RANGE_KEYS.every((key) => withinRange(readRangeField(item, key), criteria.ranges[key]));
}
