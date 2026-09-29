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
  type BestSellersListDto,
  type BestSellersPageDto,
  type BestSellersQueryDto,
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

/** A page after the seller's product allowance has been applied to it. */
interface MeteredPage {
  list: BestSellersListDto;
  lockedCount: number;
  allowance: BestSellersBrowseAllowanceDto;
}

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
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.BEST_SELLERS_ENABLED))) {
      throw new NotFoundException(BestSellersErrorKey.DISABLED);
    }

    const listType = query.listType ?? BestSellersListType.BEST_SELLERS;
    const category = normalizeCategory(query.category ?? BEST_SELLERS_ROOT_CATEGORY);
    const page = query.page ?? 1;
    const marketplace = query.marketplace ?? AmazonMarketplace.AMAZON_US;
    if (!SUPPORTED_AMAZON_MARKETPLACES.includes(marketplace)) {
      throw new BadRequestException(BestSellersErrorKey.UNSUPPORTED_MARKETPLACE);
    }
    const countryCode = AMAZON_MARKETPLACE_CONFIG[marketplace].countryCode;

    const cacheKeyParts = buildListCacheKeyParts(countryCode, listType, category, page);
    const cacheKey = this.redis.keys.key(...cacheKeyParts);
    const viewKey = buildViewKey(cacheKeyParts);
    const fetchCap = resolveDailyFetchLimit(await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_DAILY_FETCH_LIMIT));
    const counterKey = this.redis.keys.key('best-sellers', 'fetches', userId, utcDayKey(new Date()));

    // A hit costs no fetch allowance — but it IS a page the seller sees, so the
    // product allowance applies to it exactly as to a live page.
    const cached = await this.readCache(cacheKey);
    if (cached) {
      const metered = await this.applyAllowance(userId, viewKey, cached.list);
      return {
        outcome: SourceFetchOutcome.FOUND,
        list: metered.list,
        cachedAt: cached.fetchedAt,
        fetchedAt: cached.fetchedAt,
        allowance: metered.allowance,
        lockedCount: metered.lockedCount,
      };
    }

    // Miss → count it against the hidden fetch cap BEFORE the fetch, so a burst
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
      // No proxy → no request. The server's own IP is never used, and a fetch
      // that never happened is not charged against the cap; nothing was shown,
      // so nothing is charged against the allowance either.
      await this.refund(counterKey);
      this.logger.warn(`Best Sellers fetch skipped: no scraper proxy configured (${listType} ${category || 'root'} p${page})`);
      return {
        outcome: SourceFetchOutcome.NO_PROXY,
        list: null,
        cachedAt: null,
        fetchedAt: null,
        allowance: await this.readAllowance(userId),
        lockedCount: 0,
      };
    }

    let response: ScraperBestSellersResponse;
    try {
      response = await this.fetchDeduped(cacheKey, async () => {
        const rate = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS);
        return this.client.fetchBestSellers({
          marketplace: countryCode,
          listType,
          category,
          page,
          lane: ScraperLane.BROWSE,
          proxies,
          perIpRequestsPerSecond: rate,
        });
      });
    } catch (error: unknown) {
      if (error instanceof ScraperUnavailableError) {
        await this.refund(counterKey);
        throw new ServiceUnavailableException(BestSellersErrorKey.UNAVAILABLE);
      }
      throw error;
    }

    if (response.outcome === SourceFetchOutcome.FOUND && response.list) {
      await this.writeCache(cacheKey, { list: response.list, fetchedAt: response.fetchedAt });
      const metered = await this.applyAllowance(userId, viewKey, response.list);
      return {
        outcome: SourceFetchOutcome.FOUND,
        list: metered.list,
        cachedAt: null,
        fetchedAt: response.fetchedAt,
        allowance: metered.allowance,
        lockedCount: metered.lockedCount,
      };
    }
    // Any other outcome (blocked / parse_failed / not_found) is transient or
    // final for this request only: not cached, the seller may retry, the fetch
    // charge stands because the proxy capacity was spent — and no product was
    // shown, so the allowance is reported, not charged.
    return {
      outcome: response.outcome,
      list: null,
      cachedAt: null,
      fetchedAt: response.fetchedAt,
      allowance: await this.readAllowance(userId),
      lockedCount: 0,
    };
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

/** Error text for a log line — never includes a request body. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
