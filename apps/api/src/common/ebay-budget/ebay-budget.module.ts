import { Global, Module } from '@nestjs/common';

import { EbayCallBudgetService } from './ebay-call-budget.service';

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
 */
@Global()
@Module({
  providers: [EbayCallBudgetService],
  exports: [EbayCallBudgetService],
})
export class EbayBudgetModule {}
