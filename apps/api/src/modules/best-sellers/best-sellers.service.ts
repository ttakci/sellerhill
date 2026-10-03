import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AMAZON_MARKETPLACE_CONFIG,
  AmazonMarketplace,
  BEST_SELLERS_ROOT_CATEGORY,
  BestSellersErrorKey,
  BestSellersListType,
  PlatformSettingKey,
  ScraperLane,
  SUPPORTED_AMAZON_MARKETPLACES,
  SourceFetchOutcome,
  type BestSellersBrowseAllowanceDto,
  type BestSellersCategoriesDto,
  type BestSellersCategoriesQueryDto,
  type BestSellersCategoryDto,
  type BestSellersListDto,
  type BestSellersPageDto,
  type BestSellersQueryDto,
  type ScraperBestSellersRequest,
  type ScraperBestSellersResponse,
} from '@repo/shared';

import { RedisService } from '../../common/redis/redis.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { BillingRepositoryService } from '../billing/billing-repository.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { ProductSourceService } from '../listings/product-source.service';
import { ScraperClient, ScraperUnavailableError } from '../listings/scraper.client';

import {
  buildAllowance,
  buildListCacheKeyParts,
  buildTreeCacheKeyParts,
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

/** What one cached list page holds. */
interface CachedListPage {
  list: BestSellersListDto;
  fetchedAt: string | null;
}

/** Which list page to resolve. */
export interface ListTarget {
  listType: BestSellersListType;
  category: string;
  page: number;
  marketplace: AmazonMarketplace;
}

/** A list page before the seller's allowance is applied; `list` only when `outcome` is FOUND. */
interface ResolvedList {
  outcome: SourceFetchOutcome;
  list: BestSellersListDto | null;
  /** When served from the shared cache, the time it was fetched; null on a live fetch. */
  cachedAt: string | null;
  fetchedAt: string | null;
  viewKey: string;
}

/** A page after the seller's product allowance has been applied to it. */
interface MeteredPage {
  list: BestSellersListDto;
  lockedCount: number;
  allowance: BestSellersBrowseAllowanceDto;
}

/**
 * How long one node's sub-category list is kept. Amazon reshuffles a ranking
 * every hour but its category tree changes over months, so the tree outlives
 * the list cache (`bestSellers.cacheTtlMinutes`, default 6 h) by far. The
 * platform crawl (`BestSellersCrawlService`) re-reads every node once it is
 * older than `bestSellers.crawl.intervalDays` (at most 13), so with the crawl
 * on no node expires and every branch expands from cache.
 */
export const TREE_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60;

/** The per-seller miss counter outlives its UTC day by one more, so a slow midnight read still finds it. */
const FETCH_COUNTER_TTL_SECONDS = 172_800;

/**
 * Amazon Best Sellers lists for the seller app.
 *
 * One list page is shared by every seller (one cache entry per marketplace ×
 * list × category × page). The fetch itself goes through `ScraperClient` on
 * the browse lane with the shared proxy pool; with no proxy configured no HTTP
 * call is made at all, exactly like `ProductSourceService.fetch`.
 *
 * Two independent meters, and they must not be confused:
 *
 *   - The SELLER ALLOWANCE (`best_sellers_products_per_month`, migration 125):
 *     products the plan lets the seller SEE per billing period, cache hit or
 *     live fetch alike. Exhausting it never refuses — the page is truncated
 *     server-side and `lockedCount` says how many rows to render locked.
 *     Resolved through `QuotaEnforcementService`, recorded in the
 *     `best_sellers_views` ledger so the same page on the same UTC day is not
 *     charged twice.
 *   - The HIDDEN FETCH CAP (`bestSellers.dailyFetchLimit`): cache MISSES per
 *     seller per UTC day, a platform anti-abuse brake on proxy capacity that is
 *     set far above real use and answers 429 when met. Cache hits cost nothing.
 *
 * Redis is used for the cache and the fetch counter, and every Redis call
 * FAILS OPEN (same rule as `EbayCallBudgetService`): an outage means "no cache,
 * no cap", never a broken page. The billing calls fail open the same way — a
 * billing outage serves the full page unmetered rather than none of it.
 */
@Injectable()
export class BestSellersService {
  private readonly logger = new Logger(BestSellersService.name);

  /**
   * In-flight live fetches keyed on the cache key, so two sellers opening the
   * same uncached list at the same moment cause ONE scraper call. In-process
   * only: the API runs as a single replica today, and a second replica would
   * at worst duplicate one fetch, never serve a wrong answer.
   */
  private readonly inflight = new Map<string, Promise<ScraperBestSellersResponse>>();

  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly productSource: ProductSourceService,
    private readonly client: ScraperClient,
    private readonly redis: RedisService,
    private readonly quota: QuotaEnforcementService,
    private readonly billingRepository: BillingRepositoryService,
  ) {}

  async getPage(userId: string, query: BestSellersQueryDto): Promise<BestSellersPageDto> {
    const resolved = await this.resolveList(userId, {
      listType: query.listType ?? BestSellersListType.BEST_SELLERS,
      category: normalizeCategory(query.category ?? BEST_SELLERS_ROOT_CATEGORY),
      page: query.page ?? 1,
      marketplace: query.marketplace ?? AmazonMarketplace.AMAZON_US,
    });

    // A found page, cached or live, is a page the seller sees, so the product
    // allowance applies to it either way.
    if (resolved.outcome === SourceFetchOutcome.FOUND && resolved.list) {
      const metered = await this.applyAllowance(userId, resolved.viewKey, resolved.list);
      return {
        outcome: SourceFetchOutcome.FOUND,
        list: metered.list,
        cachedAt: resolved.cachedAt,
        fetchedAt: resolved.fetchedAt,
        allowance: metered.allowance,
        lockedCount: metered.lockedCount,
      };
    }
    // Nothing was shown, so the allowance is reported, not charged.
    return {
      outcome: resolved.outcome,
      list: null,
      cachedAt: null,
      fetchedAt: resolved.fetchedAt,
      allowance: await this.readAllowance(userId),
      lockedCount: 0,
    };
  }

  /**
   * The category tree beside one node (the department list at the root),
   * WITHOUT its products.
   *
   * The seller-facing tree is built one node at a time. Expanding a branch
   * used to OPEN it — the only way to learn a node's children was to load its
   * list, which charged up to 50 products of the seller's allowance for every
   * level they passed on the way down. The allowance meters products SEEN,
   * not the tree beside them, so a chevron asks here instead.
   *
   * Answered from the long-lived tree cache (`TREE_CACHE_TTL_SECONDS`), else
   * from the shared list cache, else with one live fetch of that node's list
   * page — which then also serves the list itself from cache, so opening the
   * branch afterwards is instant. The hidden fetch cap still applies to a
   * miss: proxy capacity was spent.
   */
  async getCategories(userId: string, query: BestSellersCategoriesQueryDto): Promise<BestSellersCategoriesDto> {
    // The tree-cache hit below returns before `resolveList`, so the feature
    // switch is checked here too — a disabled feature answers 404 whatever is cached.
    await this.assertEnabled();
    const target: ListTarget = {
      listType: query.listType ?? BestSellersListType.BEST_SELLERS,
      category: normalizeCategory(query.category ?? BEST_SELLERS_ROOT_CATEGORY),
      page: 1,
      marketplace: query.marketplace ?? AmazonMarketplace.AMAZON_US,
    };
    const treeKey = this.treeCacheKey(target);
    if (treeKey) {
      const cachedTree = await this.readTree(treeKey);
      if (cachedTree) {
        return { outcome: SourceFetchOutcome.FOUND, categories: cachedTree };
      }
    }
    const resolved = await this.resolveList(userId, target);
    if (resolved.outcome !== SourceFetchOutcome.FOUND || !resolved.list) {
      return { outcome: resolved.outcome, categories: [] };
    }
    // A list-cache hit from before the tree cache existed: keep its tree too.
    if (treeKey && resolved.cachedAt !== null) {
      await this.writeTree(treeKey, resolved.list.categories);
    }
    return { outcome: SourceFetchOutcome.FOUND, categories: resolved.list.categories };
  }

  /**
   * One list page, from the shared cache or a live scraper fetch: the single
   * place that talks to the scraper, applies the hidden fetch cap and refuses
   * to fetch without a proxy. It charges NOTHING against the seller's product
   * allowance; the callers decide what, if anything, the seller sees.
   */
  private async resolveList(userId: string, target: ListTarget): Promise<ResolvedList> {
    await this.assertEnabled();

    const { listType, category, page, marketplace } = target;
    if (!SUPPORTED_AMAZON_MARKETPLACES.includes(marketplace)) {
      throw new BadRequestException(BestSellersErrorKey.UNSUPPORTED_MARKETPLACE);
    }
    const countryCode = AMAZON_MARKETPLACE_CONFIG[marketplace].countryCode;

    const cacheKeyParts = buildListCacheKeyParts(countryCode, listType, category, page);
    const cacheKey = this.redis.keys.key(...cacheKeyParts);
    const viewKey = buildViewKey(cacheKeyParts);
    const fetchCap = resolveDailyFetchLimit(await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_DAILY_FETCH_LIMIT));
    const counterKey = this.redis.keys.key('best-sellers', 'fetches', userId, utcDayKey(new Date()));

    // A hit costs no fetch allowance.
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return {
        outcome: SourceFetchOutcome.FOUND,
        list: cached.list,
        cachedAt: cached.fetchedAt,
        fetchedAt: cached.fetchedAt,
        viewKey,
      };
    }

    // Miss: count it against the hidden fetch cap BEFORE the fetch, so a burst
    // of parallel misses cannot all pass the check on the same stale count.
    const usedBefore = await this.readCounter(counterKey);
    if (!decideFetchAllowed(usedBefore, fetchCap)) {
      throw new HttpException(
        { message: BestSellersErrorKey.DAILY_LIMIT_REACHED, allowance: await this.readAllowance(userId) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.charge(counterKey);

    const proxies = await this.productSource.proxies();
    if (proxies.length === 0) {
      // No proxy, no request. The server's own IP is never used, and a fetch
      // that never happened is not charged against the cap.
      await this.refund(counterKey);
      this.logger.warn(`Best Sellers fetch skipped: no scraper proxy configured (${listType} ${category || 'root'} p${page})`);
      return {
        outcome: SourceFetchOutcome.NO_PROXY,
        list: null,
        cachedAt: null,
        fetchedAt: null,
        viewKey,
      };
    }

    let response: ScraperBestSellersResponse;
    try {
      response = await this.fetchDeduped(cacheKey, () =>
        this.scraperFetch({ marketplace: countryCode, listType, category, page, lane: ScraperLane.BROWSE, proxies }),
      );
    } catch (error: unknown) {
      if (error instanceof ScraperUnavailableError) {
        await this.refund(counterKey);
        throw new ServiceUnavailableException(BestSellersErrorKey.UNAVAILABLE);
      }
      throw error;
    }

    if (response.outcome === SourceFetchOutcome.FOUND && response.list) {
      await this.writeCache(cacheKey, { list: response.list, fetchedAt: response.fetchedAt });
      const treeKey = this.treeCacheKey(target);
      if (treeKey) {
        await this.writeTree(treeKey, response.list.categories);
      }
      return { outcome: SourceFetchOutcome.FOUND, list: response.list, cachedAt: null, fetchedAt: response.fetchedAt, viewKey };
    }
    // Any other outcome (blocked / parse_failed / not_found) is transient or
    // final for this request only: not cached, the seller may retry, and the
    // fetch charge stands because the proxy capacity was spent.
    return { outcome: response.outcome, list: null, cachedAt: null, fetchedAt: response.fetchedAt, viewKey };
  }

  /**
   * For the platform crawl: a node's stored tree and its age, or null. The
   * age is read off the remaining TTL, so no timestamp is stored beside it.
   */
  async readTreeForCrawl(
    listType: BestSellersListType,
    category: string,
  ): Promise<{ categories: BestSellersCategoryDto[]; ageSeconds: number } | null> {
    const key = this.treeCacheKey(crawlTarget(listType, category));
    if (!key) {return null;}
    const categories = await this.readTree(key);
    if (!categories) {return null;}
    try {
      const ttl = await this.redis.command.ttl(key);
      return { categories, ageSeconds: ttl > 0 ? Math.max(0, TREE_CACHE_TTL_SECONDS - ttl) : TREE_CACHE_TTL_SECONDS };
    } catch {
      return { categories, ageSeconds: TREE_CACHE_TTL_SECONDS };
    }
  }

  /** For the list pre-warm: seconds the cached list page 1 still lives, null when it is not cached. */
  async listCacheRemainingSeconds(listType: BestSellersListType, category: string): Promise<number | null> {
    try {
      const ttl = await this.redis.command.ttl(this.crawlListKey(crawlTarget(listType, category)));
      return ttl > 0 ? ttl : null;
    } catch {
      return null;
    }
  }

  /**
   * The platform crawl's one fetch: on the scraper's lowest lane (behind the
   * price/stock refresh), charged to NO seller — neither the product
   * allowance nor the per-seller fetch cap. `treeOnly` reads the sidebar from
   * a single request and stores only the tree; otherwise the whole list is
   * fetched and stored as a seller's fetch would be (the pre-warm). Never
   * throws for an unreachable scraper: that reads as BLOCKED, "try again later".
   */
  async crawlFetch(
    listType: BestSellersListType,
    category: string,
    proxies: string[],
    treeOnly: boolean,
  ): Promise<{ outcome: SourceFetchOutcome; categories: BestSellersCategoryDto[] }> {
    const target = crawlTarget(listType, category);
    const cacheKey = this.crawlListKey(target);
    let response: ScraperBestSellersResponse;
    try {
      response = await this.fetchDeduped(treeOnly ? `${cacheKey}:tree-only` : cacheKey, () =>
        this.scraperFetch({
          marketplace: AMAZON_MARKETPLACE_CONFIG[target.marketplace].countryCode,
          listType,
          category: target.category,
          page: 1,
          lane: ScraperLane.CRAWL,
          proxies,
          treeOnly,
        }),
      );
    } catch (error: unknown) {
      if (error instanceof ScraperUnavailableError) {
        return { outcome: SourceFetchOutcome.BLOCKED, categories: [] };
      }
      throw error;
    }
    if (response.outcome !== SourceFetchOutcome.FOUND || !response.list) {
      return { outcome: response.outcome, categories: [] };
    }
    if (!treeOnly) {
      await this.writeCache(cacheKey, { list: response.list, fetchedAt: response.fetchedAt });
    }
    const treeKey = this.treeCacheKey(target);
    if (treeKey) {
      await this.writeTree(treeKey, response.list.categories);
    }
    return { outcome: SourceFetchOutcome.FOUND, categories: response.list.categories };
  }

  private crawlListKey(target: ListTarget): string {
    const countryCode = AMAZON_MARKETPLACE_CONFIG[target.marketplace].countryCode;
    return this.redis.keys.key(...buildListCacheKeyParts(countryCode, target.listType, target.category, 1));
  }

  /**
   * The ONE place the scraper is called (`best-sellers-egress.guard.spec.ts`).
   * An empty proxy list answers NO_PROXY with no HTTP call: the server's own
   * IP never reaches Amazon, whichever caller forgot to check.
   */
  private async scraperFetch(
    req: Omit<ScraperBestSellersRequest, 'perIpRequestsPerSecond'>,
  ): Promise<ScraperBestSellersResponse> {
    if (req.proxies.length === 0) {
      return { outcome: SourceFetchOutcome.NO_PROXY, fetchedAt: null, list: null };
    }
    const rate = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS);
    return this.client.fetchBestSellers({ ...req, perIpRequestsPerSecond: rate });
  }

  /** The operator's switch (`bestSellers.enabled`): off answers 404 on every seller-facing read. */
  private async assertEnabled(): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.BEST_SELLERS_ENABLED))) {
      throw new NotFoundException(BestSellersErrorKey.DISABLED);
    }
  }

  /** One scraper call per cache key while it is in flight. */
  private fetchDeduped(cacheKey: string, run: () => Promise<ScraperBestSellersResponse>): Promise<ScraperBestSellersResponse> {
    const existing = this.inflight.get(cacheKey);
    if (existing) {return existing;}
    const promise = run().finally(() => this.inflight.delete(cacheKey));
    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /**
   * Charge a page the seller is about to see against their product allowance
   * and cut it to what the allowance covers.
   *
   * Order matters: the ledger row is written with the remaining figure read a
   * moment before, and the allowance in the response is RE-READ after the
   * write, so the figure the seller sees is exactly what the ledger now holds
   * — not an estimate of what the write should have done.
   *
   * Fails OPEN on any billing error: the full page, nothing locked, and the
   * unmetered allowance. Browsing must never break because billing did.
   */
  private async applyAllowance(userId: string, viewKey: string, list: BestSellersListDto): Promise<MeteredPage> {
    try {
      const allowance = await this.quota.resolveBestSellersAllowance(userId);
      const remaining = resolveRemaining(allowance.limit, allowance.used);
      const visible = await this.billingRepository.recordBestSellersView(
        userId,
        viewKey,
        utcDayKey(new Date()),
        list.items.length,
        remaining,
      );
      const used =
        allowance.limit < 0 || allowance.window === null
          ? allowance.used
          : await this.billingRepository.countBestSellersProductViews(userId, allowance.window);
      return {
        list: allowance.limit < 0 ? list : truncateListItems(list, visible),
        lockedCount: allowance.limit < 0 ? 0 : resolveLockedCount(list.items.length, visible),
        allowance: buildAllowance(used, allowance.limit, allowance.creditValue),
      };
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers allowance could not be applied, serving unmetered: ${describe(error)}`);
      return { list, lockedCount: 0, allowance: { ...UNMETERED_ALLOWANCE } };
    }
  }

  /** The allowance for a response that showed no products — reported, never charged. */
  private async readAllowance(userId: string): Promise<BestSellersBrowseAllowanceDto> {
    try {
      const allowance = await this.quota.resolveBestSellersAllowance(userId);
      return buildAllowance(allowance.used, allowance.limit, allowance.creditValue);
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers allowance could not be read: ${describe(error)}`);
      return { ...UNMETERED_ALLOWANCE };
    }
  }

  private async readCache(key: string): Promise<CachedListPage | null> {
    try {
      const raw = await this.redis.command.get(key);
      if (!raw) {return null;}
      const parsed = JSON.parse(raw) as Partial<CachedListPage>;
      if (!parsed.list || !Array.isArray(parsed.list.items)) {return null;}
      return { list: parsed.list, fetchedAt: typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : null };
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers cache read failed, fetching live: ${describe(error)}`);
      return null;
    }
  }

  private async writeCache(key: string, page: CachedListPage): Promise<void> {
    try {
      const ttlMinutes = await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_CACHE_TTL_MINUTES);
      await this.redis.command.set(key, JSON.stringify(page), 'EX', Math.max(60, Math.round(ttlMinutes * 60)));
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers cache write failed: ${describe(error)}`);
    }
  }

  /** The tree cache key of a node, or null when the marketplace is not enabled (resolveList refuses it). */
  private treeCacheKey(target: ListTarget): string | null {
    if (!SUPPORTED_AMAZON_MARKETPLACES.includes(target.marketplace)) {return null;}
    const countryCode = AMAZON_MARKETPLACE_CONFIG[target.marketplace].countryCode;
    return this.redis.keys.key(...buildTreeCacheKeyParts(countryCode, target.listType, target.category));
  }

  private async readTree(key: string): Promise<BestSellersCategoryDto[] | null> {
    try {
      const raw = await this.redis.command.get(key);
      if (!raw) {return null;}
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? (parsed as BestSellersCategoryDto[]) : null;
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers tree cache read failed: ${describe(error)}`);
      return null;
    }
  }

  /** An empty tree is never stored: it would read as "this node has no children" for a week. */
  private async writeTree(key: string, categories: BestSellersCategoryDto[]): Promise<void> {
    if (categories.length === 0) {return;}
    // The crawl stores ~250k of these: the Amazon URL per row (half the bytes)
    // is dropped — the tree never renders it, and `path` rebuilds any link.
    const compact = categories.map((entry) => ({ ...entry, link: null }));
    try {
      await this.redis.command.set(key, JSON.stringify(compact), 'EX', TREE_CACHE_TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers tree cache write failed: ${describe(error)}`);
    }
  }

  private async readCounter(key: string): Promise<number> {
    try {
      const raw = await this.redis.command.get(key);
      const n = raw === null ? 0 : Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (error: unknown) {
      // Fail open: an unreadable counter reads as "nothing used today".
      this.logger.warn(`Best Sellers fetch counter read failed, not enforcing: ${describe(error)}`);
      return 0;
    }
  }

  /** INCR + EXPIRE on the hidden fetch cap; a Redis failure is logged and not enforced. */
  private async charge(key: string): Promise<void> {
    try {
      await this.redis.command.incr(key);
      await this.redis.command.expire(key, FETCH_COUNTER_TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers fetch counter charge failed, not enforcing: ${describe(error)}`);
    }
  }

  /** Hand a charge back for a fetch that never reached the scraper. */
  private async refund(key: string): Promise<void> {
    try {
      const value = await this.redis.command.decr(key);
      if (value < 0) {await this.redis.command.set(key, '0', 'EX', FETCH_COUNTER_TTL_SECONDS);}
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers fetch counter refund failed: ${describe(error)}`);
    }
  }
}

/** The crawl only covers the one enabled storefront. */
function crawlTarget(listType: BestSellersListType, category: string): ListTarget {
  return { listType, category: normalizeCategory(category), page: 1, marketplace: AmazonMarketplace.AMAZON_US };
}

/** Error text for a log line — never includes a request body. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
