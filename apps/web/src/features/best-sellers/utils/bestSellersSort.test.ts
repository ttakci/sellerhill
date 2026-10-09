import type { BestSellersItemDto } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { BestSellersSortKey } from '../bestSellers.types';

import { parseBestSellersSort, sortBestSellersItems } from './bestSellersSort';

const item = (asin: string, overrides: Partial<BestSellersItemDto> = {}): BestSellersItemDto => ({
  rank: 1,
  asin,
  title: asin,
  link: null,
  image: null,
  rating: { average: 4, count: 100 },
  price: { amount: 10, currency: 'USD' },
  priceText: '$10.00',
  rankChangePercent: null,
  previousRank: null,
  salesRank: null,
  ...overrides,
});

const asins = (items: BestSellersItemDto[]) => items.map((entry) => entry.asin);

describe('sortBestSellersItems', () => {
  const page = [
    item('A', { rank: 2, price: { amount: 30, currency: 'USD' } }),
    item('B', { rank: 1, price: null }),
    item('C', { rank: 3, price: { amount: 5, currency: 'USD' } }),
  ];

  it('orders by rank ascending, Amazon order', () => {
    expect(asins(sortBestSellersItems(page, BestSellersSortKey.RANK, 'asc'))).toEqual(['B', 'A', 'C']);
  });

  it('puts a missing value last in both directions', () => {
    expect(asins(sortBestSellersItems(page, BestSellersSortKey.PRICE, 'asc'))).toEqual(['C', 'A', 'B']);
    expect(asins(sortBestSellersItems(page, BestSellersSortKey.PRICE, 'desc'))).toEqual(['A', 'C', 'B']);
  });

  it('keeps the incoming order on ties and never mutates the input', () => {
    const tied = [item('X'), item('Y')];
    expect(asins(sortBestSellersItems(tied, BestSellersSortKey.REVIEWS, 'desc'))).toEqual(['X', 'Y']);
    expect(asins(page)).toEqual(['A', 'B', 'C']);
  });
});

describe('parseBestSellersSort', () => {
  it('reads a known key and direction only', () => {
    expect(parseBestSellersSort('price:desc')).toEqual({ key: BestSellersSortKey.PRICE, direction: 'desc' });
    expect(parseBestSellersSort('price:up')).toBeNull();
    expect(parseBestSellersSort('title:asc')).toBeNull();
  });
});
