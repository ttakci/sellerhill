// apps/api/src/modules/best-sellers/best-sellers-crawl.spec.ts
//
// The platform's Best Sellers crawl: which rows of a sidebar are the next
// nodes to visit (a leaf's siblings are NOT its children), that a pass walks
// the whole tree across ticks within its per-minute budget, that a node read
// recently is walked through without a fetch, that a blocked node is put
// back, and that nothing runs without a proxy.

import {
  BestSellersListType,
  PlatformSettingKey,
  SourceFetchOutcome,
  type BestSellersCategoryDto,
} from '@repo/shared';

import { RedisKeyService } from '../../common/redis/redis-key';
import type { RedisService } from '../../common/redis/redis.service';
import type { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import type { ProductSourceService } from '../listings/product-source.service';

import {
  childPathsOf,
  decodeCrawlItem,
  encodeCrawlItem,
  shouldStartPass,
} from './best-sellers-crawl.helpers';
import { BestSellersCrawlService } from './best-sellers-crawl.service';
import type { BestSellersService } from './best-sellers.service';

const cat = (level: number, name: string, path: string | null, extra: Partial<BestSellersCategoryDto> = {}): BestSellersCategoryDto => ({
  name,
  path,
  link: null,
  isSelected: false,
  isRoot: false,
  level,
  ...extra,
});

// amazon.com, 2026-10-03 (services/amazon-scraper/tests/fixtures).
const HEADPHONES = [
  cat(0, 'Any Department', null, { isRoot: true }),
  cat(1, 'Electronics', 'electronics'),
  cat(2, 'Headphones', null, { isSelected: true }),
  cat(3, 'Earbud', 'electronics/1'),
  cat(3, 'Open-Ear', 'electronics/2'),
];
const OPEN_EAR_LEAF = [
  cat(0, 'Any Department', null, { isRoot: true }),
  cat(1, 'Electronics', 'electronics'),
  cat(2, 'Headphones', 'electronics/172541'),
  cat(3, 'Earbud', 'electronics/1'),
  cat(3, 'Open-Ear', null, { isSelected: true }),
];

describe('best-sellers crawl helpers', () => {
  it('a middle node\'s children are the rows one level below it', () => {
    expect(childPathsOf(HEADPHONES, 'electronics/172541')).toEqual(['electronics/1', 'electronics/2']);
  });

  it('a leaf has no children — the rows around it are its siblings', () => {
    expect(childPathsOf(OPEN_EAR_LEAF, 'electronics/2')).toEqual([]);
  });

  it('the root\'s children are the departments', () => {
    const root = [cat(0, 'Any Department', null, { isRoot: true, isSelected: true }), cat(1, 'A', 'a'), cat(1, 'B', 'b')];
    expect(childPathsOf(root, '')).toEqual(['a', 'b']);
  });

  it('without levels, everything after the selected row (the old reading)', () => {
    const flat = HEADPHONES.map(({ level: _level, ...rest }) => rest);
    expect(childPathsOf(flat, 'electronics/172541')).toEqual(['electronics/1', 'electronics/2']);
  });

  it('round-trips a frontier entry and refuses anything else', () => {
    const item = { listType: BestSellersListType.NEW_RELEASES, category: 'electronics/172541', depth: 2, attempt: 1 };
    expect(decodeCrawlItem(encodeCrawlItem(item))).toEqual(item);
    expect(decodeCrawlItem('nope')).toBeNull();
    expect(decodeCrawlItem('bogus|1|0|x')).toBeNull();
  });

  it('starts a pass when none ran, or the last one is old enough', () => {
    expect(shouldStartPass(null, 1000, 500)).toBe(true);
    expect(shouldStartPass(800, 1000, 500)).toBe(false);
    expect(shouldStartPass(400, 1000, 500)).toBe(true);
  });
});

/** In-memory Redis: strings, lists and sets, enough for the crawl. */
function fakeRedis(): RedisService & { store: Map<string, string>; lists: Map<string, string[]>; sets: Map<string, Set<string>> } {
  const store = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const list = (k: string) => lists.get(k) ?? (lists.set(k, []), lists.get(k) as string[]);
  const set = (k: string) => sets.get(k) ?? (sets.set(k, new Set()), sets.get(k) as Set<string>);
  const command = {
    get: (k: string) => Promise.resolve(store.get(k) ?? null),
    set: (k: string, v: string) => (store.set(k, v), Promise.resolve('OK')),
    del: (k: string) => (store.delete(k), lists.delete(k), sets.delete(k), Promise.resolve(1)),
    llen: (k: string) => Promise.resolve(list(k).length),
    rpush: (k: string, ...v: string[]) => (list(k).push(...v), Promise.resolve(list(k).length)),
    lpop: (k: string, n: number) => {
      const out = list(k).splice(0, n);
      return Promise.resolve(out.length > 0 ? out : null);
    },
    sadd: (k: string, v: string) => {
      const had = set(k).has(v);
      set(k).add(v);
      return Promise.resolve(had ? 0 : 1);
    },
    srem: (k: string, v: string) => Promise.resolve(set(k).delete(v) ? 1 : 0),
    scard: (k: string) => Promise.resolve(set(k).size),
    expire: () => Promise.resolve(1),
  };
  return { store, lists, sets, keys: new RedisKeyService('test'), command } as unknown as RedisService & {
    store: Map<string, string>;
    lists: Map<string, string[]>;
    sets: Map<string, Set<string>>;
  };
}

/** A three-level tree for every list: root → a, b; a → a/1 (leaf); b leaf. */
function treeOf(category: string): BestSellersCategoryDto[] {
  const any = cat(0, 'Any Department', null, { isRoot: true, isSelected: category === '' });
  switch (category) {
    case '':
      return [any, cat(1, 'A', 'a'), cat(1, 'B', 'b')];
    case 'a':
      return [any, cat(1, 'A', null, { isSelected: true }), cat(2, 'A1', 'a/1')];
    case 'a/1':
      return [any, cat(1, 'A', 'a'), cat(2, 'A1', null, { isSelected: true })];
    default:
      return [any, cat(1, 'A', 'a'), cat(1, 'B', null, { isSelected: true })];
  }
}

function build(options: { proxies?: string[]; crawlPerMinute?: number; prewarmPerMinute?: number; stored?: Set<string>; blockOnce?: string } = {}) {
  const redis = fakeRedis();
  const settings: Partial<Record<PlatformSettingKey, number | boolean>> = {
    [PlatformSettingKey.BEST_SELLERS_ENABLED]: true,
    [PlatformSettingKey.BEST_SELLERS_CRAWL_ENABLED]: true,
    [PlatformSettingKey.BEST_SELLERS_CRAWL_INTERVAL_DAYS]: 7,
    [PlatformSettingKey.BEST_SELLERS_CRAWL_PAGES_PER_MINUTE]: options.crawlPerMinute ?? 100,
    [PlatformSettingKey.BEST_SELLERS_CACHE_TTL_MINUTES]: 360,
    [PlatformSettingKey.BEST_SELLERS_PREWARM_DEPTH]: 1,
    [PlatformSettingKey.BEST_SELLERS_PREWARM_PAGES_PER_MINUTE]: options.prewarmPerMinute ?? 0,
  };
  const platformSettings = {
    getBoolean: jest.fn((key: PlatformSettingKey) => Promise.resolve(settings[key] === true)),
    getNumber: jest.fn((key: PlatformSettingKey) => Promise.resolve(Number(settings[key] ?? 0))),
  };
  const productSource = { proxies: jest.fn(() => Promise.resolve(options.proxies ?? ['http://proxy.example:8080'])) };
  let blocked = false;
  const bestSellers = {
    readTreeForCrawl: jest.fn((listType: BestSellersListType, category: string) =>
      Promise.resolve(options.stored?.has(`${listType}|${category}`) ? { categories: treeOf(category), ageSeconds: 60 } : null),
    ),
    listCacheRemainingSeconds: jest.fn(() => Promise.resolve(null)),
    crawlFetch: jest.fn((_listType: BestSellersListType, category: string, _proxies: string[], treeOnly: boolean) => {
      if (category === options.blockOnce && !blocked) {
        blocked = true;
        return Promise.resolve({ outcome: SourceFetchOutcome.BLOCKED, categories: [] });
      }
      return Promise.resolve({ outcome: SourceFetchOutcome.FOUND, categories: treeOf(category), treeOnly });
    }),
  };
  const service = new BestSellersCrawlService(
    platformSettings as unknown as PlatformSettingsService,
    productSource as unknown as ProductSourceService,
    redis,
    bestSellers as unknown as BestSellersService,
  );
  return { service, redis, bestSellers };
}

const fetchedNodes = (calls: unknown[][]) => calls.map((c) => `${String(c[0])}|${String(c[1])}`).sort();

describe('BestSellersCrawlService — tree pass', () => {
  const NOW = new Date('2026-10-03T12:00:00Z');

  it('walks every node of all five lists, sidebar only, charged to no seller', async () => {
    const { service, bestSellers } = build();

    await service.runTick(NOW);

    const nodes = fetchedNodes(bestSellers.crawlFetch.mock.calls);
    expect(nodes).toHaveLength(5 * 4); // '', a, a/1, b per list
    expect(nodes).toContain('best_sellers|a/1');
    expect(nodes).toContain('most_gifted|b');
    expect(bestSellers.crawlFetch.mock.calls.every((c) => c[3] === true)).toBe(true);
  });

  it('spreads a pass over ticks within the per-minute budget, then waits for the interval', async () => {
    const { service, bestSellers } = build({ crawlPerMinute: 3 });

    for (let tick = 0; tick < 20; tick += 1) {
      await service.runTick(new Date(NOW.getTime() + tick * 60_000));
    }
    expect(bestSellers.crawlFetch).toHaveBeenCalledTimes(20);

    // The pass is finished: nothing more until seven days after it started.
    await service.runTick(new Date(NOW.getTime() + 2 * 86_400_000));
    expect(bestSellers.crawlFetch).toHaveBeenCalledTimes(20);
    // A new pass, again three pages a minute.
    await service.runTick(new Date(NOW.getTime() + 7 * 86_400_000));
    expect(bestSellers.crawlFetch).toHaveBeenCalledTimes(23);
  });

  it('walks through a node read this week without fetching it again', async () => {
    const stored = new Set(['best_sellers|', 'best_sellers|a']);
    const { service, bestSellers } = build({ stored });

    await service.runTick(NOW);

    const nodes = fetchedNodes(bestSellers.crawlFetch.mock.calls);
    expect(nodes).not.toContain('best_sellers|');
    expect(nodes).not.toContain('best_sellers|a');
    expect(nodes).toContain('best_sellers|a/1'); // reached THROUGH the stored ones
  });

  it('puts a blocked node back and reads it later in the pass', async () => {
    const { service, bestSellers } = build({ blockOnce: 'a' });

    await service.runTick(NOW);

    const aCalls = bestSellers.crawlFetch.mock.calls.filter((c) => c[0] === BestSellersListType.BEST_SELLERS && c[1] === 'a');
    expect(aCalls).toHaveLength(2);
    expect(fetchedNodes(bestSellers.crawlFetch.mock.calls)).toContain('best_sellers|a/1');
  });

  it('does nothing without a proxy', async () => {
    const { service, bestSellers, redis } = build({ proxies: [] });

    await service.runTick(NOW);

    expect(bestSellers.crawlFetch).not.toHaveBeenCalled();
    expect(redis.lists.size).toBe(0);
  });
});

describe('BestSellersCrawlService — list pre-warm', () => {
  it('fetches whole Best Sellers lists down to the configured depth only', async () => {
    const { service, bestSellers } = build({ crawlPerMinute: 0, prewarmPerMinute: 50 });

    await service.runTick(new Date('2026-10-03T12:00:00Z'));

    expect(fetchedNodes(bestSellers.crawlFetch.mock.calls)).toEqual(['best_sellers|', 'best_sellers|a', 'best_sellers|b']);
    expect(bestSellers.crawlFetch.mock.calls.every((c) => c[3] === false)).toBe(true);
  });
});
