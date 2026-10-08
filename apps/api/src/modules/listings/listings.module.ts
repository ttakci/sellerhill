import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { AdminModule } from '../admin/admin.module';
import { BillingModule } from '../billing/billing.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { EbayModule } from '../ebay/ebay.module';
import { ListingSettingsGroupModule } from '../listing-settings-groups/listing-settings-group.module';
import { LlmModule } from '../llm/llm.module';
import { OrdersModule } from '../orders/orders.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { VeroModule } from '../vero/vero.module';

import { ContentGenerationService } from './content-generation.service';
import { EbayFeedSyncProcessor, EBAY_FEED_SYNC_QUEUE } from './ebay-feed-sync.processor';
import { EbayFeedSyncService } from './ebay-feed-sync.service';
import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { LISTING_CLEANUP_QUEUE, ListingCleanupProcessor } from './listing-cleanup.processor';
import { ListingCleanupService } from './listing-cleanup.service';
import { ListingImportService } from './listing-import.service';
import { ListingProcessorService } from './listing-processor.service';
import { ListingQueueService } from './listing-queue.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ProductSourceModule } from './product-source.module';
import { ProductSyncService } from './product-sync.service';
import { RefreshProcessorService } from './refresh-processor.service';
import { RefreshSchedulerService } from './refresh-scheduler.service';
import { StockSyncProcessorService } from './stock-sync-processor.service';
import { TopListingsController } from './top-listings.controller';

@Module({
  imports: [
    DatabaseModule,
    AdminModule,
    BillingModule,
    ConfigModule,
    // The top-sellers tab ranks through DashboardService. Dashboard imports
    // nothing from Listings, so this adds no cycle — module-cycle.guard.spec.ts
    // proves it.
    DashboardModule,
    EbayModule,
    ListingSettingsGroupModule,
    // For adopting a newly imported listing's PAST orders (OrderSyncService).
    // Orders does not import Listings, so this adds no cycle —
    // module-cycle.guard.spec.ts proves it.
    OrdersModule,
    LlmModule,
    StoreSettingsModule,
    // The platform VeRO list the create worker checks a product's brand against.
    VeroModule,
    // ScraperClient + ProductSourceService live in their own module — see
    // product-source.module.ts for why (AdminModule, which this module
    // already imports, needs them too in Task 12, and importing ListingsModule
    // from AdminModule back would close a cycle).
    ProductSourceModule,
    BullModule.registerQueue(
      { name: 'listings' },
      { name: 'stock-sync' },
      { name: 'keepa-refresh' },
      { name: EBAY_FEED_SYNC_QUEUE },
      { name: LISTING_CLEANUP_QUEUE }
    ),
  ],
  controllers: [ListingsController, TopListingsController],
  providers: [
    ListingsService,
    ListingImportService,
    KeepaService,
    KeepaUsageService,
    ProductSyncService,
    RefreshSchedulerService,
    RefreshProcessorService,
    ListingProcessorService,
    ListingQueueService,
    ListingStrategyService,
    ContentGenerationService,
    StockSyncProcessorService,
    EbayFeedSyncService,
    EbayFeedSyncProcessor,
    ListingCleanupService,
    ListingCleanupProcessor,
  ],
  exports: [ListingsService, ListingQueueService],
})
export class ListingsModule {}
