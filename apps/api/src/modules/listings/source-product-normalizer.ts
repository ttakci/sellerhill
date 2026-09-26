import {
  SourceFetchOutcome,
  SourceStockStatus,
  type ScraperProductResult,
  type SourceCommerce,
} from '@repo/shared';

/**
 * Scraper page signals → provider-independent commerce state.
 *
 * Rules (spec "Stock status", evidence from ~1,300 product pages):
 * - "Only N left" is shown for N ≤ 20 → EXACT N.
 * - "In Stock" with no count → AT_LEAST. A seller order limit suppresses the
 *   "Only N left" message while stock is above the limit, so when the Buy Box
 *   dropdown max D is below the floor, D is the only safe lower bound.
 * - "Currently unavailable" / isInStock=false → OUT_OF_STOCK 0.
 * - 404 → OUT_OF_STOCK 0, removed.
 * - Unreadable availability → UNKNOWN (caller keeps the previous stock).
 * A missing price is always null, never 0: failing to read a price is not
 * evidence the product is free.
 */
export type NormalizedObservation =
  | { kind: 'observed'; commerce: SourceCommerce }
  | { kind: 'data_failure' }
  | { kind: 'transport' };

export function normalizeScraperCommerce(result: ScraperProductResult, inStockFloor: number): NormalizedObservation {
  switch (result.outcome) {
    case SourceFetchOutcome.BLOCKED:
    case SourceFetchOutcome.NO_PROXY:
      return { kind: 'transport' };
    case SourceFetchOutcome.PARSE_FAILED:
      return { kind: 'data_failure' };
    case SourceFetchOutcome.NOT_FOUND:
      return {
        kind: 'observed',
        commerce: { price: null, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: null, removed: true },
      };
    case SourceFetchOutcome.FOUND:
      break;
    default:
      return { kind: 'data_failure' };
  }

  const s = result.signals;
  if (!s) {
    return { kind: 'data_failure' };
  }
  const price = typeof s.price === 'number' && s.price > 0 ? s.price : null;
  const quantityMax = typeof s.quantityMax === 'number' && s.quantityMax > 0 ? s.quantityMax : null;

  if (s.isInStock === false) {
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (typeof s.onlyLeft === 'number' && s.onlyLeft >= 0) {
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.EXACT, stock: s.onlyLeft, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (s.isInStock === true) {
    const stock = quantityMax !== null && quantityMax < inStockFloor ? quantityMax : inStockFloor;
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.AT_LEAST, stock, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (price === null) {
    return { kind: 'data_failure' };
  }
  return {
    kind: 'observed',
    commerce: { price, stockStatus: SourceStockStatus.UNKNOWN, stock: null, maxOrderQuantity: quantityMax, removed: false },
  };
}
