import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ProductSourceModule } from '../listings/product-source.module';

import { BestSellersController } from './best-sellers.controller';
import { BestSellersService } from './best-sellers.service';

/**
 * Amazon Best Sellers browsing. Depends on `ProductSourceModule` (the scraper
 * client + proxy list, cycle-safe by design — see its own note), `BillingModule`
 * (the per-plan product allowance and its view ledger, migration 125 —
 * BillingModule imports only EmailModule and its own queues, so this cannot
 * close a cycle) and the global `RedisService` / `PlatformSettingsService`.
 * Nothing imports this module back.
 */
@Module({
  imports: [AuthModule, ProductSourceModule, BillingModule],
  controllers: [BestSellersController],
  providers: [BestSellersService],
})
export class BestSellersModule {}
