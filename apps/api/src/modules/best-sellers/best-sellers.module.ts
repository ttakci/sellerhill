import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ProductSourceModule } from '../listings/product-source.module';

import { BEST_SELLERS_CRAWL_QUEUE, BestSellersCrawlProcessor } from './best-sellers-crawl.processor';
import { BestSellersCrawlService } from './best-sellers-crawl.service';
import { BestSellersController } from './best-sellers.controller';
import { BestSellersService } from './best-sellers.service';

/**
 * Amazon Best Sellers browsing. Depends on `ProductSourceModule` (the scraper
 * client + proxy list, cycle-safe by design — see its own note), `BillingModule`
 * (the per-plan product allowance and its view ledger, migration 125 —
 * BillingModule imports only EmailModule and its own queues, so this cannot
 * close a cycle) and the global `RedisService` / `PlatformSettingsService`.
 * Nothing imports this module back. It also owns the platform's tree crawl
 * and list pre-warm (`best-sellers-crawl` queue, see BestSellersCrawlService).
 */
@Module({
  imports: [AuthModule, ProductSourceModule, BillingModule, BullModule.registerQueue({ name: BEST_SELLERS_CRAWL_QUEUE })],
  controllers: [BestSellersController],
  providers: [BestSellersService, BestSellersCrawlService, BestSellersCrawlProcessor],
})
export class BestSellersModule {}
