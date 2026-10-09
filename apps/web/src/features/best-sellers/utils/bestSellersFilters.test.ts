import type { BestSellersItemDto } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_BEST_SELLERS_FILTERS,
  hasActiveBestSellersFilters,
  matchesBestSellersFilters,
  parseFilterNumber,
  toBestSellersFilterCriteria,
} from './bestSellersFilters';

const item = (overrides: Partial<BestSellersItemDto> = {}): BestSellersItemDto => ({
  rank: 1,
  asin: 'B0TEST0001',
  title: 'Sample',
  link: null,
  image: null,
  rating: { average: 4.5, count: 1200 },
  price: { amount: 19.99, currency: 'USD' },
  priceText: '$19.99',
  rankChangePercent: null,
  previousRank: null,
  salesRank: null,
  ...overrides,
});

const criteria = (values: Partial<typeof EMPTY_BEST_SELLERS_FILTERS>) =>
  toBestSellersFilterCriteria({ ...EMPTY_BEST_SELLERS_FILTERS, ...values });

describe('parseFilterNumber', () => {
  it('reads blanks and junk as no constraint', () => {
    expect(parseFilterNumber('')).toBeNull();
    expect(parseFilterNumber('  ')).toBeNull();
    expect(parseFilterNumber('abc')).toBeNull();
    expect(parseFilterNumber('-3')).toBeNull();
  });

  it('accepts a decimal comma', () => {
    expect(parseFilterNumber('4,5')).toBe(4.5);
  });
});

describe('matchesBestSellersFilters', () => {
  it('passes everything with no filter set', () => {
    const empty = criteria({});
    expect(hasActiveBestSellersFilters(empty)).toBe(false);
    expect(matchesBestSellersFilters(item({ rating: null, price: null }), empty)).toBe(true);
  });

  it('applies rating, reviews and the price range inclusively', () => {
    expect(matchesBestSellersFilters(item(), criteria({ minRating: '4.5' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ minRating: '4.6' }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ minReviews: '1200' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ minReviews: '1201' }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ priceMin: '19.99', priceMax: '19.99' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ priceMax: '15' }))).toBe(false);
  });

  it('matches the search text against title and ASIN, case-insensitively', () => {
    expect(matchesBestSellersFilters(item({ title: 'Steel Water Bottle' }), criteria({ search: ' water ' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ search: 'b0test' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ search: 'lamp' }))).toBe(false);
    expect(matchesBestSellersFilters(item({ title: null }), criteria({ search: 'sample' }))).toBe(false);
    expect(hasActiveBestSellersFilters(criteria({ search: '   ' }))).toBe(false);
  });

  it('fails a product whose field is unknown', () => {
    expect(matchesBestSellersFilters(item({ rating: null }), criteria({ minRating: '3' }))).toBe(false);
    expect(matchesBestSellersFilters(item({ price: null }), criteria({ priceMax: '100' }))).toBe(false);
  });
});
