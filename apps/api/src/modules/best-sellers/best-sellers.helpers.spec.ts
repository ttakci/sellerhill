import { BestSellersListType } from '@repo/shared';

import {
  buildAllowance,
  buildListCacheKeyParts,
  decideFetchAllowed,
  normalizeCategory,
  resolveDailyFetchLimit,
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

describe('utcDayKey', () => {
  it('buckets on the UTC date, not local time', () => {
    expect(utcDayKey(new Date('2026-09-29T23:59:59.999Z'))).toBe('2026-09-29');
    expect(utcDayKey(new Date('2026-09-30T00:00:00.000Z'))).toBe('2026-09-30');
  });
});

describe('resolveDailyFetchLimit', () => {
  it('returns the platform setting as a whole, non-negative number', () => {
    expect(resolveDailyFetchLimit(100)).toBe(100);
    expect(resolveDailyFetchLimit(12.7)).toBe(12);
    expect(resolveDailyFetchLimit(-3)).toBe(0);
  });
});

describe('buildAllowance', () => {
  it('reports remaining and clamps it at zero', () => {
    expect(buildAllowance(3, 100)).toEqual({ used: 3, limit: 100, remaining: 97 });
    expect(buildAllowance(101, 100)).toEqual({ used: 101, limit: 100, remaining: 0 });
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
