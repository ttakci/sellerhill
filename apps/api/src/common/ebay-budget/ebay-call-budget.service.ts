import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EbayApiResource,
  EbayCallPriority,
  PlatformSettingKey,
  type EbayCallBudgetStatusDto,
} from '@repo/shared';

import { RedisService } from '../redis/redis.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import { budgetWindow, effectiveLimit } from './ebay-call-budget.helpers';

/** Redis script name for the atomic acquire. */
const ACQUIRE_SCRIPT = 'ebayBudgetAcquire';

/**
 * Reserve budget for one or more calls, atomically.
 *
 * Read-then-write in application code would let two workers each see "9,998
 * used of 10,000" and both proceed. Doing the compare and the increment inside
 * Redis makes the whole thing one indivisible step, which is what allows any
 * number of API replicas and queue workers to share a single quota.
 *
 * KEYS[1] counter, ARGV[1] limit, ARGV[2] cost, ARGV[3] ttl seconds.
 * Returns { granted, remaining }.
 */
const ACQUIRE_LUA = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])

if used + cost > limit then
  return { 0, limit - used }
end

local total = redis.call('INCRBY', KEYS[1], cost)
if total == cost then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
end
return { 1, limit - total }
`;

/** Which platform setting carries each resource's ceiling. */
const LIMIT_SETTING: Record<EbayApiResource, PlatformSettingKey> = {
  [EbayApiResource.INVENTORY]: PlatformSettingKey.EBAY_BUDGET_INVENTORY_DAILY_LIMIT,
  [EbayApiResource.TAXONOMY]: PlatformSettingKey.EBAY_BUDGET_TAXONOMY_DAILY_LIMIT,
  [EbayApiResource.ACCOUNT]: PlatformSettingKey.EBAY_BUDGET_ACCOUNT_DAILY_LIMIT,
  [EbayApiResource.FULFILLMENT]: PlatformSettingKey.EBAY_BUDGET_FULFILLMENT_DAILY_LIMIT,
  [EbayApiResource.TRADING]: PlatformSettingKey.EBAY_BUDGET_TRADING_DAILY_LIMIT,
  [EbayApiResource.ANALYTICS]: PlatformSettingKey.EBAY_BUDGET_TRADING_DAILY_LIMIT,
};

/**
 * Distributed daily budget for eBay API calls.
 *
 * eBay's quotas are per APPLICATION — every seller on the platform draws from
 * the same pool — so the counter has to be shared across API replicas and queue
 * workers, which is why it lives in Redis rather than in process memory.
 *
 * This is a governor, not a gate: when it runs out, background work is deferred
 * to the next reset instead of failing, and if Redis itself is unavailable the
 * call is allowed through. eBay's own 429 (already handled by
 * `withEbayRateLimitRetry`) remains the hard stop; losing the ability to COUNT
 * calls is not a reason to stop making them.
 */
@Injectable()
export class EbayCallBudgetService implements OnModuleInit {
  private readonly logger = new Logger(EbayCallBudgetService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly platformSettings: PlatformSettingsService
  ) {}

  onModuleInit(): void {
    this.redis.registerScript(ACQUIRE_SCRIPT, ACQUIRE_LUA);
  }

  /**
   * Charge `cost` calls against a resource, or throw `EbayBudgetExhaustedError`.
   *
   * Callers on a queue should catch that error and re-schedule the job for
   * `error.resetAt` rather than marking the work failed — the work is fine, the
   * day's allowance is not.
   */
  async acquire(
    resource: EbayApiResource,
    priority: EbayCallPriority = EbayCallPriority.BACKGROUND,
    cost = 1
  ): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_BUDGET_ENABLED))) {
      return;
    }

    const window = budgetWindow(new Date());
    const limit = await this.resolveLimit(resource);
    const reserve = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT);
    const ceiling = effectiveLimit(limit, reserve, priority);

    let granted: boolean;
    let remaining: number;
    try {
      const result = (await this.redis.runScript(
        ACQUIRE_SCRIPT,
        [this.counterKey(resource, window.day)],
        [ceiling, cost, window.ttlSeconds]
      )) as [number, number];
      granted = result[0] === 1;
      remaining = result[1];
    } catch (error: unknown) {
      // Fail open: an unreachable Redis must not stop the platform listing.
      this.logger.warn(
        `eBay call budget unavailable for ${resource}, allowing the call: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    if (!granted) {
      this.logger.warn(
        `eBay ${resource} budget exhausted for ${window.day} ` +
          `(${priority} ceiling ${ceiling}, ${remaining} left); deferring until ${window.resetAt.toISOString()}`
      );
      throw new EbayBudgetExhaustedError(resource, window.resetAt);
    }
  }

  /**
   * Give budget back after a call that never reached eBay.
   *
   * Only correct when the request demonstrably did not leave — a failed
   * pre-flight, an aborted batch. A call that reached eBay and errored still
   * consumed quota and must NOT be refunded.
   */
  async release(resource: EbayApiResource, cost = 1): Promise<void> {
    try {
      await this.redis.command.decrby(this.counterKey(resource, budgetWindow(new Date()).day), cost);
    } catch {
      // Best-effort: an un-refunded call only makes us slightly more conservative.
    }
  }

  /** Current utilization for every resource — the admin panel's read model. */
  async status(): Promise<EbayCallBudgetStatusDto[]> {
    const window = budgetWindow(new Date());
    const reserve = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT);

    return Promise.all(
      Object.values(EbayApiResource).map(async (resource) => {
        const limit = await this.resolveLimit(resource);
        let used = 0;
        try {
          used = Number(await this.redis.command.get(this.counterKey(resource, window.day))) || 0;
        } catch {
          used = 0;
        }

        return {
          resource,
          limit,
          used,
          remaining: Math.max(0, limit - used),
          backgroundLimit: effectiveLimit(limit, reserve, EbayCallPriority.BACKGROUND),
          resetAt: window.resetAt.toISOString(),
          // Ceilings are configured today; an Analytics-API sync would flip this.
          observed: false,
        };
      })
    );
  }

  private async resolveLimit(resource: EbayApiResource): Promise<number> {
    return this.platformSettings.getNumber(LIMIT_SETTING[resource]);
  }

  private counterKey(resource: EbayApiResource, day: string): string {
    return this.redis.keys.key('ebay', 'budget', resource, day);
  }
}
