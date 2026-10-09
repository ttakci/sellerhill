import type { BestSellersItemDto } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { BestSellersRangeKey, type BestSellersRangeValue } from '../bestSellers.types';

import {
  EMPTY_BEST_SELLERS_FILTERS,
  hasActiveBestSellersFilters,
  matchesBestSellersFilters,
  parseFilterNumber,
  toBestSellersFilterCriteria,
} from './bestSellersFilters';

const item = (overrides: Partial<BestSellersItemDto> = {}): BestSellersItemDto => ({
  rank: 7,
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

const criteria = ({
  search = '',
  minRating = '',
  ranges = {},
}: {
  search?: string;
  minRating?: string;
  ranges?: Partial<Record<BestSellersRangeKey, Partial<BestSellersRangeValue>>>;
}) =>
  toBestSellersFilterCriteria({
    search,
    minRating,
    ranges: {
      [BestSellersRangeKey.PRICE]: { min: '', max: '', ...ranges[BestSellersRangeKey.PRICE] },
      [BestSellersRangeKey.REVIEWS]: { min: '', max: '', ...ranges[BestSellersRangeKey.REVIEWS] },
      [BestSellersRangeKey.RANK]: { min: '', max: '', ...ranges[BestSellersRangeKey.RANK] },
    },
  });

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
    const empty = toBestSellersFilterCriteria(EMPTY_BEST_SELLERS_FILTERS);
    expect(hasActiveBestSellersFilters(empty)).toBe(false);
    expect(matchesBestSellersFilters(item({ rating: null, price: null, rank: null }), empty)).toBe(true);
  });

  it('applies rating and every range inclusively', () => {
    expect(matchesBestSellersFilters(item(), criteria({ minRating: '4.5' }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ minRating: '4.6' }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { reviews: { min: '1200' } } }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { reviews: { min: '1201' } } }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { reviews: { max: '1000' } } }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { price: { min: '19.99', max: '19.99' } } }))).toBe(
      true,
    );
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { price: { max: '15' } } }))).toBe(false);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { rank: { max: '10' } } }))).toBe(true);
    expect(matchesBestSellersFilters(item(), criteria({ ranges: { rank: { min: '1', max: '5' } } }))).toBe(false);
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
    expect(matchesBestSellersFilters(item({ price: null }), criteria({ ranges: { price: { max: '100' } } }))).toBe(
      false,
    );
    expect(matchesBestSellersFilters(item({ rank: null }), criteria({ ranges: { rank: { max: '10' } } }))).toBe(false);
  });
});
