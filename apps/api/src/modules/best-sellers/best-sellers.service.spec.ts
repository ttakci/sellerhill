// apps/api/src/modules/best-sellers/best-sellers.service.spec.ts
//
// The product allowance (migration 125) decides what a paying seller SEES, so
// its application is asserted here against fakes: the cut is server-side, a
// page reopened the same day is not charged again, an unmetered seller sees
// everything, a billing failure serves the whole page, and a suspended seller
// sees every row locked.

import {
  BestSellersListType,
  PlatformSettingKey,
  SourceFetchOutcome,
  type BestSellersListDto,
  type ScraperBestSellersResponse,
} from '@repo/shared';

import { RedisKeyService } from '../../common/redis/redis-key';
import type { RedisService } from '../../common/redis/redis.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { BillingRepositoryService } from '../billing/billing-repository.service';
import type { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { QuotaWindowOutcome, type QuotaWindow } from '../billing/quota-helpers';
import type { ProductSourceService } from '../listings/product-source.service';
import type { ScraperClient } from '../listings/scraper.client';

import { BestSellersService } from './best-sellers.service';

const USER = 'user-1';

const WINDOW: QuotaWindow = {
  periodStart: new Date('2026-09-15T00:00:00Z'),
  periodEnd: new Date('2026-10-15T00:00:00Z'),
  outcome: QuotaWindowOutcome.NORMAL,
};

function listOf(count: number): BestSellersListDto {
  return {
    title: 'Best Sellers',
    category: null,
    listType: BestSellersListType.BEST_SELLERS,
    link: null,
    items: Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      asin: `B0000000${String(i).padStart(2, '0')}`,
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
    categories: [],
    relatedLists: [],
    pagination: { page: 1, itemsPerPage: 50, totalPages: 2, totalCount: 100 },
  };
}

/** In-memory Redis: enough of ioredis for the cache + the fetch counter. */
function fakeRedis(): RedisService & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const command = {
    get: (k: string) => Promise.resolve(store.get(k) ?? null),
    set: (k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    },
    incr: (k: string) => {
      const n = Number(store.get(k) ?? '0') + 1;
      store.set(k, String(n));
      return Promise.resolve(n);
    },
    decr: (k: string) => {
      const n = Number(store.get(k) ?? '0') - 1;
      store.set(k, String(n));
      return Promise.resolve(n);
    },
    expire: () => Promise.resolve(1),
  };
  return { store, keys: new RedisKeyService('test'), command } as unknown as RedisService & {
    store: Map<string, string>;
  };
}

/**
 * In-memory `best_sellers_views`, replaying the SQL's arithmetic so the
 * service's flow (remaining → record → re-read) is exercised end to end.
 */
function fakeLedger() {
  const rows = new Map<string, number>();
  const sum = () => [...rows.values()].reduce((a, b) => a + b, 0);
  const repository = {
    countBestSellersProductViews: jest.fn(() => Promise.resolve(sum())),
    recordBestSellersView: jest.fn(
      (_user: string, viewKey: string, viewedOn: string, items: number, remaining: number) => {
        const key = `${viewKey}|${viewedOn}`;
        const grant = remaining < 0 ? items : remaining;
        const existing = rows.get(key);
        const next =
          existing === undefined ? Math.min(items, grant) : Math.min(items, Math.max(existing, existing + grant));
        rows.set(key, next);
        return Promise.resolve(next);
      },
    ),
  };
  return { rows, sum, repository };
}

function build(options: {
  limit: number;
  creditValue?: number;
  quotaThrows?: boolean;
  scraper?: ScraperBestSellersResponse;
  proxies?: string[];
}) {
  const ledger = fakeLedger();
  const redis = fakeRedis();
  const platformSettings = {
    getBoolean: jest.fn(() => Promise.resolve(true)),
    getNumber: jest.fn((key: PlatformSettingKey) => {
      switch (key) {
        case PlatformSettingKey.BEST_SELLERS_DAILY_FETCH_LIMIT:
          return Promise.resolve(1000);
        case PlatformSettingKey.BEST_SELLERS_CACHE_TTL_MINUTES:
          return Promise.resolve(360);
        default:
          return Promise.resolve(1);
      }
    }),
  };
  const productSource = {
    proxies: jest.fn(() => Promise.resolve(options.proxies ?? ['http://proxy.example:8080'])),
  };
  const scraperResponse: ScraperBestSellersResponse = options.scraper ?? {
    outcome: SourceFetchOutcome.FOUND,
    fetchedAt: '2026-09-29T10:00:00.000Z',
    list: listOf(50),
  };
  const client = { fetchBestSellers: jest.fn(() => Promise.resolve(scraperResponse)) };
  const quota = {
    resolveBestSellersAllowance: jest.fn(() => {
      if (options.quotaThrows) {
        return Promise.reject(new Error('billing db down'));
      }
      return Promise.resolve({
        limit: options.limit,
        used: options.limit < 0 ? 0 : ledger.sum(),
        creditValue: options.creditValue ?? 0,
        window: WINDOW,
      });
    }),
  };
  const service = new BestSellersService(
    platformSettings as unknown as PlatformSettingsService,
    productSource as unknown as ProductSourceService,
    client as unknown as ScraperClient,
    redis,
    quota as unknown as QuotaEnforcementService,
    ledger.repository as unknown as BillingRepositoryService,
  );
  return { service, ledger, redis, client, quota };
}

describe('BestSellersService — product allowance', () => {
  it('cuts a metered seller\'s page to what is left and locks the rest, server-side', async () => {
    const { service, ledger } = build({ limit: 100 });
    // 70 already viewed on another page this period.
    ledger.rows.set('US:new_releases:root:1|2026-09-29', 70);

    const page = await service.getPage(USER, {});

    expect(page.outcome).toBe(SourceFetchOutcome.FOUND);
    expect(page.list?.items).toHaveLength(30);
    expect(page.lockedCount).toBe(20);
    expect(page.allowance).toEqual({ used: 100, limit: 100, remaining: 0, creditValue: 0 });
  });

  it('does not charge the same page again on the same UTC day', async () => {
    const { service, ledger, client } = build({ limit: 100 });
    ledger.rows.set('US:new_releases:root:1|2026-09-29', 70);

    const first = await service.getPage(USER, {});
    const second = await service.getPage(USER, {});

    // The second open is a cache hit — one scraper call — and still metered.
    expect(client.fetchBestSellers).toHaveBeenCalledTimes(1);
    expect(second.cachedAt).toBe(first.fetchedAt);
    expect(second.list?.items).toHaveLength(30);
    expect(second.lockedCount).toBe(20);
    expect(second.allowance.used).toBe(100);
    expect(ledger.sum()).toBe(100);
  });

  it('upgrades a page first opened at zero remaining once a top-up lands', async () => {
    const opts = { limit: 100 };
    const { service, ledger } = build(opts);
    ledger.rows.set('US:new_releases:root:1|2026-09-29', 100);

    const before = await service.getPage(USER, {});
    expect(before.list?.items).toHaveLength(0);
    expect(before.lockedCount).toBe(50);

    // A 2,500-product pack credited to this window.
    opts.limit = 2_600;
    const after = await service.getPage(USER, {});
    expect(after.list?.items).toHaveLength(50);
    expect(after.lockedCount).toBe(0);
    expect(after.allowance.used).toBe(150);
  });

  it('an unmetered seller sees everything and the view is still recorded', async () => {
    const { service, ledger } = build({ limit: -1 });

    const page = await service.getPage(USER, {});

    expect(page.list?.items).toHaveLength(50);
    expect(page.lockedCount).toBe(0);
    expect(page.allowance).toEqual({ used: 0, limit: -1, remaining: -1, creditValue: 0 });
    expect(ledger.repository.recordBestSellersView).toHaveBeenCalledWith(
      USER,
      'US:best_sellers:root:1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      50,
      -1,
    );
    expect(ledger.sum()).toBe(50);
  });

  it('a billing failure fails OPEN: full page, nothing locked, unmetered allowance', async () => {
    const { service, ledger } = build({ limit: 100, quotaThrows: true });

    const page = await service.getPage(USER, {});

    expect(page.list?.items).toHaveLength(50);
    expect(page.lockedCount).toBe(0);
    expect(page.allowance).toEqual({ used: 0, limit: -1, remaining: -1, creditValue: 0 });
    expect(ledger.repository.recordBestSellersView).not.toHaveBeenCalled();
  });

  it('a suspended seller (limit 0) has every row locked', async () => {
    const { service } = build({ limit: 0 });

    const page = await service.getPage(USER, {});

    expect(page.list?.items).toEqual([]);
    expect(page.lockedCount).toBe(50);
    expect(page.allowance).toEqual({ used: 0, limit: 0, remaining: 0, creditValue: 0 });
  });

  it('reports the top-up share on the allowance', async () => {
    const { service } = build({ limit: 2_600, creditValue: 2_500 });

    const page = await service.getPage(USER, {});

    expect(page.allowance).toEqual({ used: 50, limit: 2_600, remaining: 2_550, creditValue: 2_500 });
  });

  it('charges nothing when no product was shown', async () => {
    const { service, ledger } = build({
      limit: 100,
      scraper: { outcome: SourceFetchOutcome.BLOCKED, fetchedAt: '2026-09-29T10:00:00.000Z', list: null },
    });

    const page = await service.getPage(USER, {});

    expect(page.outcome).toBe(SourceFetchOutcome.BLOCKED);
    expect(page.list).toBeNull();
    expect(page.lockedCount).toBe(0);
    expect(page.allowance).toEqual({ used: 0, limit: 100, remaining: 100, creditValue: 0 });
    expect(ledger.repository.recordBestSellersView).not.toHaveBeenCalled();
  });

  it('makes no scraper call and charges nothing without a proxy', async () => {
    const { service, ledger, client } = build({ limit: 100, proxies: [] });

    const page = await service.getPage(USER, {});

    expect(page.outcome).toBe(SourceFetchOutcome.NO_PROXY);
    expect(client.fetchBestSellers).not.toHaveBeenCalled();
    expect(page.lockedCount).toBe(0);
    expect(ledger.repository.recordBestSellersView).not.toHaveBeenCalled();
  });
});
