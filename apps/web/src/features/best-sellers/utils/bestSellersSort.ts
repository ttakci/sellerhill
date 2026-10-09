/**
 * Pure ordering of one Best Sellers page. Amazon's own order (rank ascending)
 * is the default; the other keys let a seller look at the same 50 products by
 * price, rating or review count without a new fetch (and so without spending
 * any allowance).
 */
import type { BestSellersItemDto } from '@repo/shared';

import { BestSellersSortKey, type BestSellersSort, type BestSellersSortDirection } from '../bestSellers.types';

export const DEFAULT_BEST_SELLERS_SORT: BestSellersSort = {
  key: BestSellersSortKey.RANK,
  direction: 'asc',
};

const SORT_KEYS = new Set<string>(Object.values(BestSellersSortKey));

/** `price:desc` → `{ key: PRICE, direction: 'desc' }`; anything else → null. */
export function parseBestSellersSort(value: string): BestSellersSort | null {
  const [key, direction] = value.split(':');
  if (!SORT_KEYS.has(key) || (direction !== 'asc' && direction !== 'desc')) {
    return null;
  }
  return { key: key as BestSellersSortKey, direction };
}

export const formatBestSellersSort = (sort: BestSellersSort): string => `${sort.key}:${sort.direction}`;

function readSortField(item: BestSellersItemDto, key: BestSellersSortKey): number | null {
  switch (key) {
    case BestSellersSortKey.PRICE:
      return item.price?.amount ?? null;
    case BestSellersSortKey.RATING:
      return item.rating?.average ?? null;
    case BestSellersSortKey.REVIEWS:
      return item.rating?.count ?? null;
    case BestSellersSortKey.RANK_CHANGE:
      return item.rankChangePercent;
    case BestSellersSortKey.RANK:
    default:
      return item.rank;
  }
}

/**
 * A new array in the requested order. A product Amazon printed WITHOUT the
 * field (no price, no rating yet) goes last in BOTH directions: "cheapest
 * first" must not open on products whose price is unknown. Ties keep
 * Amazon's order (Array.prototype.sort is stable), so equal prices still read
 * best-ranked first.
 */
export function sortBestSellersItems(
  items: readonly BestSellersItemDto[],
  key: BestSellersSortKey,
  direction: BestSellersSortDirection,
): BestSellersItemDto[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = readSortField(a, key);
    const right = readSortField(b, key);
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1;
    }
    return (left - right) * sign;
  });
}
