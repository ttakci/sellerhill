import { BestSellersListType, type BestSellersListDto } from '@repo/shared';

import {
  buildAllowance,
  buildListCacheKeyParts,
  buildViewKey,
  decideFetchAllowed,
  normalizeCategory,
  resolveDailyFetchLimit,
  resolveLockedCount,
  resolveRemaining,
  truncateListItems,
  UNMETERED_ALLOWANCE,
  utcDayKey,
} from './best-sellers.helpers';

describe('normalizeCategory', () => {
  it('maps undefined, null and blank to the root category', () => {
    expect(normalizeCategory(undefined)).toBe('');
    expect(normalizeCategory(null)).toBe('');
    expect(normalizeCategory('   ')).toBe('');
  });

  it('trims and lowercases an alias', () => {
    expect(normalizeCategory(' Electronics/172541 ')).toBe('electronics/172541');
  });
});

describe('buildListCacheKeyParts', () => {
  it('uses "root" for the empty category', () => {
    expect(buildListCacheKeyParts('US', BestSellersListType.BEST_SELLERS, '', 1)).toEqual([
      'best-sellers', 'list', 'US', 'best_sellers', 'root', '1',
    ]);
  });

  it('rewrites the alias slash so the key stays readable', () => {
    expect(buildListCacheKeyParts('US', BestSellersListType.NEW_RELEASES, 'electronics/172541', 2)).toEqual([
      'best-sellers', 'list', 'US', 'new_releases', 'electronics_172541', '2',
    ]);
  });
});

describe('buildViewKey', () => {
  it('identifies the page by the same parts as the cache key, minus the constant prefix', () => {
    const parts = buildListCacheKeyParts('US', BestSellersListType.MOST_GIFTED, 'toys-and-games/165793011', 2);
    expect(buildViewKey(parts)).toBe('US:most_gifted:toys-and-games_165793011:2');
  });

  it('fits the ledger column even for the longest allowed alias', () => {
    const alias = `${'a'.repeat(110)}/123456789`;
    const parts = buildListCacheKeyParts('US', BestSellersListType.MOVERS_AND_SHAKERS, alias, 1);
    expect(buildViewKey(parts).length).toBeLessThanOrEqual(200);
  });
});

describe('utcDayKey', () => {
  it('buckets on the UTC date, not local time', () => {
    expect(utcDayKey(new Date('2026-09-29T23:59:59.999Z'))).toBe('2026-09-29');
    expect(utcDayKey(new Date('2026-09-30T00:00:00.000Z'))).toBe('2026-09-30');
  });
});

describe('resolveDailyFetchLimit', () => {
  it('returns the platform setting as a whole, non-negative number', () => {
    expect(resolveDailyFetchLimit(1000)).toBe(1000);
    expect(resolveDailyFetchLimit(12.7)).toBe(12);
    expect(resolveDailyFetchLimit(-3)).toBe(0);
  });
});

describe('resolveRemaining', () => {
  it('is -1 whenever the seller is unmetered', () => {
    expect(resolveRemaining(-1, 0)).toBe(-1);
    expect(resolveRemaining(-1, 99_999)).toBe(-1);
  });

  it('is the headroom left, clamped at zero when the ledger overshoots', () => {
    expect(resolveRemaining(100, 30)).toBe(70);
    expect(resolveRemaining(100, 100)).toBe(0);
    expect(resolveRemaining(100, 140)).toBe(0);
  });

  it('a suspended seller (limit 0) has nothing left', () => {
    expect(resolveRemaining(0, 0)).toBe(0);
  });
});

describe('buildAllowance', () => {
  it('reports remaining and clamps it at zero', () => {
    expect(buildAllowance(3, 100, 0)).toEqual({ used: 3, limit: 100, remaining: 97, creditValue: 0 });
    expect(buildAllowance(101, 100, 0)).toEqual({ used: 101, limit: 100, remaining: 0, creditValue: 0 });
  });

  it('carries the top-up share and -1 for an unmetered seller', () => {
    expect(buildAllowance(2_000, 4_000, 2_500)).toEqual({ used: 2_000, limit: 4_000, remaining: 2_000, creditValue: 2_500 });
    expect(buildAllowance(0, -1, 0)).toEqual({ used: 0, limit: -1, remaining: -1, creditValue: 0 });
  });

  it('UNMETERED_ALLOWANCE is what an unmetered seller reads', () => {
    expect(UNMETERED_ALLOWANCE).toEqual(buildAllowance(0, -1, 0));
  });
});

describe('resolveLockedCount', () => {
  it('is the rows the allowance did not cover, never negative', () => {
    expect(resolveLockedCount(50, 30)).toBe(20);
    expect(resolveLockedCount(50, 50)).toBe(0);
    expect(resolveLockedCount(50, 80)).toBe(0);
    expect(resolveLockedCount(50, 0)).toBe(50);
  });
});

describe('truncateListItems', () => {
  const list: BestSellersListDto = {
    title: 'Best Sellers',
    category: null,
    listType: BestSellersListType.BEST_SELLERS,
    link: null,
    items: Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      asin: `B00000000${i}`,
      title: `Item ${i}`,
      link: null,
      image: null,
      rating: null,
      price: null,
      priceText: null,
      rankChangePercent: null,
      previousRank: null,
      salesRank: null,
    })),
    categories: [{ name: 'All', path: null, link: null, isSelected: true, isRoot: true }],
    relatedLists: [],
    pagination: { page: 1, itemsPerPage: 50, totalPages: 2, totalCount: 100 },
  };

  it('keeps only the first N products and leaves navigation untouched', () => {
    const cut = truncateListItems(list, 2);
    expect(cut.items.map((i) => i.asin)).toEqual(['B000000000', 'B000000001']);
    expect(cut.categories).toBe(list.categories);
    expect(cut.pagination).toBe(list.pagination);
  });

  it('returns the same list when the allowance covers it all', () => {
    expect(truncateListItems(list, 5)).toBe(list);
    expect(truncateListItems(list, 99)).toBe(list);
  });

  it('a seller with nothing left sees no products at all', () => {
    expect(truncateListItems(list, 0).items).toEqual([]);
    expect(truncateListItems(list, -3).items).toEqual([]);
  });
});

describe('decideFetchAllowed', () => {
  it('allows while under the limit and refuses at it', () => {
    expect(decideFetchAllowed(0, 1)).toBe(true);
    expect(decideFetchAllowed(99, 100)).toBe(true);
    expect(decideFetchAllowed(100, 100)).toBe(false);
  });

  it('a limit of 0 refuses everyone', () => {
    expect(decideFetchAllowed(0, 0)).toBe(false);
  });
});
