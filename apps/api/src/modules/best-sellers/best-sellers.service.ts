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
  type BestSellersListDto,
  type BestSellersPageDto,
  type BestSellersQueryDto,
  type ScraperBestSellersResponse,
} from '@repo/shared';

import { RedisService } from '../../common/redis/redis.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { ProductSourceService } from '../listings/product-source.service';
import { ScraperClient, ScraperUnavailableError } from '../listings/scraper.client';

import {
  buildAllowance,
  buildListCacheKeyParts,
  decideFetchAllowed,
  normalizeCategory,
  resolveDailyFetchLimit,
  utcDayKey,
} from './best-sellers.helpers';

/** What one cached list page holds. */
interface CachedListPage {
  list: BestSellersListDto;
  fetchedAt: string | null;
}

/** The per-seller miss counter outlives its UTC day by one more, so a slow midnight read still finds it. */
const FETCH_COUNTER_TTL_SECONDS = 172_800;

/**
 * Amazon Best Sellers lists for the seller app.
 *
 * One list page is shared by every seller (one cache entry per marketplace ×
 * list × category × page), and a per-seller daily cap counts cache MISSES
 * only — browsing what someone else already fetched costs nothing. The fetch
 * itself goes through `ScraperClient` on the browse lane with the shared
 * proxy pool; with no proxy configured no HTTP call is made at all, exactly
 * like `ProductSourceService.fetch`.
 *
 * Redis is used for the cache and the counter, and every Redis call FAILS OPEN
 * (same rule as `EbayCallBudgetService`): an outage means "no cache, no cap",
 * never a broken page.
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

    const cacheKey = this.redis.keys.key(...buildListCacheKeyParts(countryCode, listType, category, page));
    const limit = resolveDailyFetchLimit(await this.platformSettings.getNumber(PlatformSettingKey.BEST_SELLERS_DAILY_FETCH_LIMIT));
    const counterKey = this.redis.keys.key('best-sellers', 'fetches', userId, utcDayKey(new Date()));

    // A hit costs no allowance.
    const cached = await this.readCache(cacheKey);
    if (cached) {
      const used = await this.readCounter(counterKey);
      return {
        outcome: SourceFetchOutcome.FOUND,
        list: cached.list,
        cachedAt: cached.fetchedAt,
        fetchedAt: cached.fetchedAt,
        allowance: buildAllowance(used, limit),
      };
    }

    // Miss → charge the seller BEFORE the fetch, so a burst of parallel misses
    // cannot all pass the check on the same stale count.
    const usedBefore = await this.readCounter(counterKey);
    if (!decideFetchAllowed(usedBefore, limit)) {
      throw new HttpException(
        { message: BestSellersErrorKey.DAILY_LIMIT_REACHED, allowance: buildAllowance(usedBefore, limit) },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const used = await this.charge(counterKey, usedBefore);
    const allowance = buildAllowance(used, limit);

    const proxies = await this.productSource.proxies();
    if (proxies.length === 0) {
      // No proxy → no request. The server's own IP is never used, and a fetch
      // that never happened is not charged.
      await this.refund(counterKey);
      this.logger.warn(`Best Sellers fetch skipped: no scraper proxy configured (${listType} ${category || 'root'} p${page})`);
      return {
        outcome: SourceFetchOutcome.NO_PROXY,
        list: null,
        cachedAt: null,
        fetchedAt: null,
        allowance: buildAllowance(Math.max(0, used - 1), limit),
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
    }
    // Any other outcome (blocked / parse_failed / not_found) is transient or
    // final for this request only: not cached, the seller may retry, and the
    // charge stands because the proxy capacity was spent.

    return {
      outcome: response.outcome,
      list: response.outcome === SourceFetchOutcome.FOUND ? response.list : null,
      cachedAt: null,
      fetchedAt: response.fetchedAt,
      allowance,
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
      this.logger.warn(`Best Sellers allowance read failed, not enforcing: ${describe(error)}`);
      return 0;
    }
  }

  /** INCR + EXPIRE; on a Redis failure the local estimate stands in so the response still carries a figure. */
  private async charge(key: string, usedBefore: number): Promise<number> {
    try {
      const used = await this.redis.command.incr(key);
      await this.redis.command.expire(key, FETCH_COUNTER_TTL_SECONDS);
      return used;
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers allowance charge failed, not enforcing: ${describe(error)}`);
      return usedBefore + 1;
    }
  }

  /** Hand a charge back for a fetch that never reached the scraper. */
  private async refund(key: string): Promise<void> {
    try {
      const value = await this.redis.command.decr(key);
      if (value < 0) {await this.redis.command.set(key, '0', 'EX', FETCH_COUNTER_TTL_SECONDS);}
    } catch (error: unknown) {
      this.logger.warn(`Best Sellers allowance refund failed: ${describe(error)}`);
    }
  }
}

/** Error text for a log line — never includes a request body. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
