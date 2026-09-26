import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EbayApiResource, EbayCallPriority, PlatformSettingKey } from '@repo/shared';

import { RedisService } from '../redis/redis.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import { budgetWindow, effectiveLimit, governedWindows } from './ebay-call-budget.helpers';
import { EbayRateLimitStore } from './ebay-rate-limit.store';
import type { MappedLimit } from './ebay-rate-limits';

/** Redis script name for the atomic acquire. */
const ACQUIRE_SCRIPT = 'ebayBudgetAcquire';

/**
 * Reserve budget against every window of a resource, atomically and
 * all-or-nothing.
 *
 * Read-then-write in application code would let two workers each see "9,998
 * used of 10,000" and both proceed; checking every window and only then
 * incrementing every window inside one script makes the whole thing
 * indivisible, and means a call refused by a short window never spends any of
 * the daily allowance.
 *
 * KEYS[i] counter i. ARGV[1] cost; for key i, ARGV[2i] its limit and
 * ARGV[2i+1] its ttl seconds. A limit of -1 means eBay gave no ceiling for
 * that window: count, never refuse (spec D2).
 * Returns { 1, 0 } when granted, { 0, i } when window i refused.
 */
export const ACQUIRE_LUA = `
local cost = tonumber(ARGV[1])
for i = 1, #KEYS do
  local limit = tonumber(ARGV[2 * i])
  if limit >= 0 then
    local used = tonumber(redis.call('GET', KEYS[i]) or '0')
    if used + cost > limit then
      return { 0, i }
    end
  end
end
for i = 1, #KEYS do
  local total = redis.call('INCRBY', KEYS[i], cost)
  if total == cost then
    redis.call('EXPIRE', KEYS[i], tonumber(ARGV[2 * i + 1]))
  end
end
return { 1, 0 }
`;

/**
 * Distributed budget for eBay API calls, enforcing EVERY window eBay reports
 * for a resource — not only the daily one.
 *
 * eBay's quotas are per APPLICATION — every seller on the platform draws from
 * the same pool — so the counter has to be shared across API replicas and queue
 * workers, which is why it lives in Redis rather than in process memory.
 *
 * Ceilings come from eBay's own `getRateLimits` response, via
 * `EbayRateLimitStore` — there is no configured ceiling for any window. When
 * eBay has not reported a limit for a resource (never fetched, or a resource
 * it stopped naming), the governor counts the call but never refuses it: eBay
 * is the only source of a ceiling, and inventing one here would be exactly the
 * guesswork this design replaces.
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
    private readonly platformSettings: PlatformSettingsService,
    private readonly rateLimits: EbayRateLimitStore
  ) {}

  onModuleInit(): void {
    this.redis.registerScript(ACQUIRE_SCRIPT, ACQUIRE_LUA);
  }

  /**
   * Charge `cost` calls against a resource, or throw `EbayBudgetExhaustedError`.
   *
   * Callers on a queue should catch that error and re-schedule the job for
   * `error.resetAt` rather than marking the work failed — the work is fine,
   * the exhausted window's allowance is not (which may reset in seconds, not
   * at UTC midnight, when the refusal came from a sub-daily window).
   */
  async acquire(
    resource: EbayApiResource,
    priority: EbayCallPriority = EbayCallPriority.BACKGROUND,
    cost = 1
  ): Promise<void> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.EBAY_BUDGET_ENABLED))) {
      return;
    }

    const windows = governedWindows(await this.resolveMapped(resource), new Date());
    const reserve = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT);
    const keys = windows.map((w) => this.counterKey(resource, w.keyParts));
    const args: number[] = [cost];
    for (const w of windows) {
      args.push(w.limit === null ? -1 : effectiveLimit(w.limit, reserve, priority), w.ttlSeconds);
    }

    let result: [number, number];
    try {
      result = (await this.redis.runScript(ACQUIRE_SCRIPT, keys, args)) as [number, number];
    } catch (error: unknown) {
      // Fail open: an unreachable Redis must not stop the platform listing.
      this.logger.warn(
        `eBay call budget unavailable for ${resource}, allowing the call: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    if (result[0] !== 1) {
      const refused = windows[result[1] - 1] ?? windows[0];
      this.logger.warn(
        `eBay ${resource} budget exhausted for its ${refused.windowSeconds}s window ` +
          `(${priority}); deferring until ${refused.resetAt.toISOString()}`
      );
      throw new EbayBudgetExhaustedError(resource, refused.resetAt, refused.windowSeconds);
    }
  }

  /** Our own count for today, per resource — compared against eBay's, never substituted for it. */
  async countsToday(): Promise<Record<EbayApiResource, number>> {
    const day = budgetWindow(new Date()).day;
    const entries = await Promise.all(
      Object.values(EbayApiResource).map(async (resource) => {
        try {
          return [resource, Number(await this.redis.command.get(this.counterKey(resource, [day]))) || 0] as const;
        } catch {
          return [resource, 0] as const;
        }
      })
    );
    return Object.fromEntries(entries) as Record<EbayApiResource, number>;
  }

  /** eBay's own figures for this resource, or null when eBay has never reported any — never a number we made up. */
  private async resolveMapped(resource: EbayApiResource): Promise<MappedLimit | null> {
    const snapshot = await this.rateLimits.current();
    return snapshot?.mapped.byResource[resource] ?? null;
  }

  private counterKey(resource: EbayApiResource, keyParts: string[]): string {
    return this.redis.keys.key('ebay', 'budget', resource, ...keyParts);
  }
}
