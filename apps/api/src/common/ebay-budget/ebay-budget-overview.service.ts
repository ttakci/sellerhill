import { Injectable } from '@nestjs/common';
import { PlatformSettingKey, type EbayBudgetOverviewDto } from '@repo/shared';

import { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayAnalyticsService } from './ebay-analytics.service';
import { buildBudgetOverview } from './ebay-call-budget.helpers';
import { EbayCallBudgetService } from './ebay-call-budget.service';

/** The admin panel's read model: eBay's figures (cached 60s) beside our own counter. */
@Injectable()
export class EbayBudgetOverviewService {
  constructor(
    private readonly analytics: EbayAnalyticsService,
    private readonly budget: EbayCallBudgetService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async get(): Promise<EbayBudgetOverviewDto> {
    const [{ snapshot, live }, counts, reservePercent] = await Promise.all([
      this.analytics.forPanel(),
      this.budget.countsToday(),
      this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT),
    ]);
    return buildBudgetOverview({ snapshot, live, counts, reservePercent, now: new Date() });
  }
}
