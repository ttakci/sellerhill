import { Injectable, Logger } from '@nestjs/common';
import {
  BEST_SELLERS_LIST_TYPE_ORDER,
  BEST_SELLERS_ROOT_CATEGORY,
  BestSellersListType,
  PlatformSettingKey,
  SourceFetchOutcome,
  type BestSellersCategoryDto,
} from '@repo/shared';

import { RedisService } from '../../common/redis/redis.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { runWithConcurrency } from '../../common/utils/concurrency';
import { ProductSourceService } from '../listings/product-source.service';

import {
  CRAWL_MAX_ATTEMPTS,
  childPathsOf,
  crawlNodeKey,
  decodeCrawlItem,
  encodeCrawlItem,
  shouldStartPass,
  type CrawlItem,
} from './best-sellers-crawl.helpers';
import { BestSellersService } from './best-sellers.service';

/** Scraper calls one tick keeps in flight; the pool's per-IP rate is what actually paces them. */
const CRAWL_CONCURRENCY = 4;

/** Nodes one tick may walk, cached or not — bounds a tick that finds a whole pass already in cache. */
const MAX_VISITS_PER_TICK = 2000;

/** The per-pass seen-set outlives any pass, so an abandoned one cannot pin memory for ever. */
const SEEN_TTL_SECONDS = 21 * 24 * 60 * 60;

/** One kind of pass over the tree. */
interface PassConfig {
  name: 'tree' | 'prewarm';
  roots: CrawlItem[];
  intervalMs: number;
  perMinute: number;
  /** Children of a node at this depth are not queued. */
  maxDepth: number;
  /** Read the sidebar only (one request) or the whole list (the pre-warm). */
  treeOnly: boolean;
  /** The node's tree when what is stored is still good enough for this pass, else null (fetch it). */
  stored: (item: CrawlItem) => Promise<BestSellersCategoryDto[] | null>;
}

/**
 * The platform's own walk over Amazon's Best Sellers category tree.
 *
 * Two passes, each resumable across ticks — a Redis list is the frontier, a
 * set the nodes already visited in this pass, so a restart loses at most the
 * tick in flight:
 *
 *   - TREE (`bestSellers.crawl.*`): every node of all five lists, sidebar only
 *     (one request each), stored in the 14-day tree cache. A node read within
 *     `intervalDays` (a seller expanded it, or the last pass did) is not
 *     fetched again, only walked through. ~250k nodes (sampled 2026-10-03).
 *   - PRE-WARM (`bestSellers.prewarm.*`): the Best Sellers LIST (products) of
 *     every node down to `depth`, once per list-cache period, so the pages
 *     sellers pass through first open from cache.
 *
 * Neither charges any seller (no allowance, no per-seller fetch cap). Both
 * run on the scraper's lowest lane, `crawl`, which only takes capacity the
 * create, browse and price/stock-refresh lanes leave idle, and both stop
 * when no proxy is configured — the crawl never reaches Amazon from the
 * server's own IP.
 */
@Injectable()
export class BestSellersCrawlService {
  private readonly logger = new Logger(BestSellersCrawlService.name);

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly productSource: ProductSourceService,
    private readonly redis: RedisService,
    private readonly bestSellers: BestSellersService,
  ) {}

  async runTick(now: Date = new Date()): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.BEST_SELLERS_ENABLED))) {return;}
    const proxies = await this.productSource.proxies();
    if (proxies.length === 0) {
      this.logger.debug('Best Sellers crawl idle: no scraper proxy configured');
      return;
    }

    if (await this.platformSettings.getBoolean(PlatformSettingKey.BEST_SELLERS_CRAWL_ENABLED)) {
      const intervalDays = await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_CRAWL_INTERVAL_DAYS);
      const intervalSeconds = intervalDays * 24 * 60 * 60;
      await this.runPass(
        {
          name: 'tree',
          roots: BEST_SELLERS_LIST_TYPE_ORDER.map((listType) => rootItem(listType)),
          intervalMs: intervalSeconds * 1000,
          perMinute: await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_CRAWL_PAGES_PER_MINUTE),
          maxDepth: Number.POSITIVE_INFINITY,
          treeOnly: true,
          stored: async (item) => {
            const tree = await this.bestSellers.readTreeForCrawl(item.listType, item.category);
            return tree && tree.ageSeconds < intervalSeconds ? tree.categories : null;
          },
        },
        proxies,
        now,
      );
    }

    const cacheTtlSeconds = (await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_CACHE_TTL_MINUTES)) * 60;
    await this.runPass(
      {
        name: 'prewarm',
        roots: [rootItem(BestSellersListType.BEST_SELLERS)],
        intervalMs: cacheTtlSeconds * 1000,
        perMinute: await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_PREWARM_PAGES_PER_MINUTE),
        maxDepth: await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_PREWARM_DEPTH),
        treeOnly: false,
        // A list that still has more than half its life left is not fetched
        // again; one closer to expiry is, so it never lapses between passes.
        stored: async (item) => {
          const remaining = await this.bestSellers.listCacheRemainingSeconds(item.listType, item.category);
          if (remaining === null || remaining < cacheTtlSeconds / 2) {return null;}
          const tree = await this.bestSellers.readTreeForCrawl(item.listType, item.category);
          return tree ? tree.categories : null;
        },
      },
      proxies,
      now,
    );
  }

  private async runPass(pass: PassConfig, proxies: string[], now: Date): Promise<void> {
    if (pass.perMinute <= 0) {return;}
    const keys = this.keysOf(pass.name);
    try {
      if ((await this.redis.command.llen(keys.frontier)) === 0) {
        const startedRaw = await this.redis.command.get(keys.startedAt);
        if (!shouldStartPass(startedRaw === null ? null : Number(startedRaw), now.getTime(), pass.intervalMs)) {return;}
        await this.redis.command.del(keys.seen);
        await this.redis.command.rpush(keys.frontier, ...pass.roots.map(encodeCrawlItem));
        await this.redis.command.set(keys.startedAt, String(now.getTime()));
        this.logger.log(`Best Sellers ${pass.name} pass started`);
      }

      // The budget is scraper requests: a node walked through from cache costs
      // none, so a tick keeps popping until it has fetched `perMinute` pages,
      // the frontier is empty, or it has walked MAX_VISITS_PER_TICK nodes.
      const budget = Math.floor(pass.perMinute);
      const outcomes: VisitOutcome[] = [];
      let spent = 0;
      while (spent < budget && outcomes.length < MAX_VISITS_PER_TICK) {
        const take = Math.min(budget - spent, CRAWL_CONCURRENCY * 2);
        const raws = (await this.redis.command.lpop(keys.frontier, take)) ?? [];
        if (raws.length === 0) {break;}
        const items = raws.map(decodeCrawlItem).filter((item): item is CrawlItem => item !== null);
        const round: VisitOutcome[] = [];
        await runWithConcurrency(items, CRAWL_CONCURRENCY, async (item, index) => {
          round[index] = await this.visit(pass, item, proxies, keys);
        });
        outcomes.push(...round);
        spent += round.filter((o) => o === 'fetched' || o === 'retry' || o === 'dropped').length;
      }

      if (outcomes.length > 0 && (await this.redis.command.llen(keys.frontier)) === 0) {
        const startedRaw = await this.redis.command.get(keys.startedAt);
        const hours = startedRaw ? ((now.getTime() - Number(startedRaw)) / 3_600_000).toFixed(1) : '?';
        const visited = await this.redis.command.scard(keys.seen);
        this.logger.log(`Best Sellers ${pass.name} pass finished: ${visited} nodes in ${hours} h`);
      }
      const fetched = outcomes.filter((o) => o === 'fetched').length;
      const retried = outcomes.filter((o) => o === 'retry').length;
      if (fetched > 0 || retried > 0) {
        this.logger.debug(`Best Sellers ${pass.name} tick: ${fetched} fetched, ${retried} put back, ${outcomes.length} visited`);
      }
    } catch (error: unknown) {
      // Fail soft: a Redis hiccup costs one tick, never the API process.
      this.logger.warn(`Best Sellers ${pass.name} tick failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async visit(
    pass: PassConfig,
    item: CrawlItem,
    proxies: string[],
    keys: PassKeys,
  ): Promise<VisitOutcome> {
    const nodeKey = crawlNodeKey(item);
    if ((await this.redis.command.sadd(keys.seen, nodeKey)) === 0) {return 'seen';}
    await this.redis.command.expire(keys.seen, SEEN_TTL_SECONDS);

    let categories = await pass.stored(item);
    let outcome: 'fetched' | 'stored' = 'stored';
    if (!categories) {
      const result = await this.bestSellers.crawlFetch(item.listType, item.category, proxies, pass.treeOnly);
      if (result.outcome === SourceFetchOutcome.BLOCKED && item.attempt + 1 < CRAWL_MAX_ATTEMPTS) {
        // Busier lanes or a blocked proxy: try this node again at the back of the queue.
        await this.redis.command.srem(keys.seen, nodeKey);
        await this.redis.command.rpush(keys.frontier, encodeCrawlItem({ ...item, attempt: item.attempt + 1 }));
        return 'retry';
      }
      if (result.outcome !== SourceFetchOutcome.FOUND) {return 'dropped';}
      categories = result.categories;
      outcome = 'fetched';
    }

    if (item.depth < pass.maxDepth) {
      const children = childPathsOf(categories, item.category).map((category) =>
        encodeCrawlItem({ listType: item.listType, category, depth: item.depth + 1, attempt: 0 }),
      );
      if (children.length > 0) {
        await this.redis.command.rpush(keys.frontier, ...children);
      }
    }
    return outcome;
  }

  private keysOf(name: PassConfig['name']): PassKeys {
    return {
      frontier: this.redis.keys.key('best-sellers', 'crawl', name, 'frontier'),
      seen: this.redis.keys.key('best-sellers', 'crawl', name, 'seen'),
      startedAt: this.redis.keys.key('best-sellers', 'crawl', name, 'started-at'),
    };
  }
}

type VisitOutcome = 'fetched' | 'stored' | 'seen' | 'retry' | 'dropped';

interface PassKeys {
  frontier: string;
  seen: string;
  startedAt: string;
}

function rootItem(listType: BestSellersListType): CrawlItem {
  return { listType, category: BEST_SELLERS_ROOT_CATEGORY, depth: 0, attempt: 0 };
}
