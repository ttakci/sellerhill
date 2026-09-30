// apps/api/src/modules/ebay-returns/return-sweep-schedule.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EbayAccountStatus, EbayApiResource, PlatformSettingKey } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { resolveReturnSweepInterval, ResolvedReturnSweepInterval } from './return-sweep-interval';

/** How long one resolution is reused. The inputs move slowly; the readers poll. */
const CACHE_TTL_MS = 60_000;

/**
 * The interval the return sweep is running at RIGHT NOW.
 *
 * One answer for everything that needs it: the sweep's claim (which stores are
 * due), and the freshness horizon the Returns page and the Action Center
 * derive from it. They must agree — a page that calls a row stale on a
 * different interval than the sweep refreshes it at would flag healthy returns
 * as unconfirmed.
 *
 * Inputs: the number of ACTIVE stores, eBay's own daily limit for
 * `post-order.return` (from `getRateLimits`, via the budget service — never a
 * figure typed here), and the two settings. Cached briefly because the Action
 * Center is polled from the app shell.
 *
 * Fail-soft: if the store count or the limit cannot be read, the manual
 * setting is used. A scheduling helper must never break a page load.
 */
@Injectable()
export class ReturnSweepScheduleService {
  private readonly logger = new Logger(ReturnSweepScheduleService.name);
  private cached: { value: ResolvedReturnSweepInterval; at: number } | null = null;
  private lastLogged: string | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly budget: EbayCallBudgetService
  ) {}

  async resolve(): Promise<ResolvedReturnSweepInterval> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < CACHE_TTL_MS) {
      return this.cached.value;
    }

    const manualIntervalHours = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_HOURS);
    let value: ResolvedReturnSweepInterval;
    try {
      const [autoEnabled, quotaSharePercent, activeStores, dailyCeiling] = await Promise.all([
        this.platformSettings.getBoolean(PlatformSettingKey.EBAY_RETURN_SYNC_INTERVAL_AUTO),
        this.platformSettings.getNumber(PlatformSettingKey.EBAY_RETURN_SYNC_QUOTA_PERCENT),
        this.countActiveStores(),
        this.budget.backgroundDailyCeiling(EbayApiResource.POST_ORDER_RETURN),
      ]);
      value = resolveReturnSweepInterval({
        autoEnabled,
        manualIntervalHours,
        activeStores,
        dailyCeiling,
        quotaSharePercent,
      });
    } catch (err) {
      this.logger.warn(
        `Return sweep interval could not be derived, using the manual value: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      value = resolveReturnSweepInterval({
        autoEnabled: false,
        manualIntervalHours,
        activeStores: 0,
        dailyCeiling: null,
        quotaSharePercent: 0,
      });
    }

    this.cached = { value, at: now };
    this.logChange(value);
    return value;
  }

  private async countActiveStores(): Promise<number> {
    const rows = await this.database.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM ebay_accounts WHERE status = $1`,
      [EbayAccountStatus.ACTIVE]
    );
    return Number(rows[0]?.count ?? 0) || 0;
  }

  /** One line when the pace changes — the operator's way to see what auto decided. */
  private logChange(value: ResolvedReturnSweepInterval): void {
    const signature = `${value.intervalHours}|${value.source}`;
    if (signature === this.lastLogged) {
      return;
    }
    this.lastLogged = signature;
    this.logger.log(
      `Return sweep interval: every ${value.intervalHours}h (${value.source}), ` +
        `about ${value.estimatedDailyCalls} eBay call(s) a day`
    );
  }
}
