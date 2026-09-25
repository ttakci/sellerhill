import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { EbayAnalyticsService } from './ebay-analytics.service';
import { EbayCallBudgetService } from './ebay-call-budget.service';
import { EbayRateLimitRefreshProcessor, EBAY_RATE_LIMIT_REFRESH_QUEUE } from './ebay-rate-limit-refresh.processor';
import { EbayRateLimitStore } from './ebay-rate-limit.store';

/**
 * Global, like `SettingsModule` and `RedisModule`, and for the same reason.
 *
 * The budget ledger is consumed by eBay clients, queue workers and the admin
 * read surface alike. Wiring it as a normal feature-module export would force
 * AdminModule to import EbayModule, which closes the documented
 * `EbayModule -> LlmModule -> AdminModule -> EbayModule` cycle that
 * `module-cycle.guard.spec.ts` exists to prevent.
 *
 * It depends only on Redis and platform settings — there is nothing
 * eBay-specific in it beyond the resource names — so it belongs in `common`.
 *
 * `EbayRateLimitStore` (the persisted "what eBay last said" row) and
 * `EbayAnalyticsService` (the thing that asks eBay and calls `.save()`) live
 * here for the same reason: both the governor (`EbayCallBudgetService`, via
 * the store) and the admin panel (via the analytics service) need them, and
 * neither belongs to a feature module. The dependency direction is one-way —
 * `EbayAnalyticsService` depends on `EbayCallBudgetService` (it counts its
 * own `rate_limit` calls against the Analytics ceiling) — never the reverse,
 * which would be a DI cycle inside this module.
 *
 * `DatabaseService` (used by `EbayRateLimitStore`) and `ConfigService` (used
 * by `EbayAnalyticsService`) both come from globally-exported modules
 * (`DatabaseModule`, `ConfigModule.forRoot({ isGlobal: true })`) — same as
 * `RedisService`/`PlatformSettingsService` above, which is why this module's
 * `imports` never lists `DatabaseModule`/`SettingsModule` either.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EBAY_RATE_LIMIT_REFRESH_QUEUE })],
  providers: [EbayCallBudgetService, EbayRateLimitStore, EbayAnalyticsService, EbayRateLimitRefreshProcessor],
  exports: [EbayCallBudgetService, EbayRateLimitStore, EbayAnalyticsService],
})
export class EbayBudgetModule {}
