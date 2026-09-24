import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { AdminModule } from '../admin/admin.module';
import { BillingModule } from '../billing/billing.module';
import { EbayModule } from '../ebay/ebay.module';
import { ImageMirrorModule } from '../image-mirror/image-mirror.module';
import { ListingSettingsGroupModule } from '../listing-settings-groups/listing-settings-group.module';
import { LlmModule } from '../llm/llm.module';
import { OrdersModule } from '../orders/orders.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { ContentGenerationService } from './content-generation.service';
import { EbayFeedSyncProcessor, EBAY_FEED_SYNC_QUEUE } from './ebay-feed-sync.processor';
import { EbayFeedSyncService } from './ebay-feed-sync.service';
import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { ListingImportService } from './listing-import.service';
import { ListingProcessorService } from './listing-processor.service';
import { ListingQueueService } from './listing-queue.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ProductSyncService } from './product-sync.service';
import { RefreshProcessorService } from './refresh-processor.service';
import { RefreshSchedulerService } from './refresh-scheduler.service';
import { StockSyncProcessorService } from './stock-sync-processor.service';

@Module({
  imports: [
    DatabaseModule,
    AdminModule,
    BillingModule,
    ConfigModule,
    EbayModule,
    ImageMirrorModule,
    ListingSettingsGroupModule,
    // For adopting a newly imported listing's PAST orders (OrderSyncService).
    // Orders does not import Listings, so this adds no cycle —
    // module-cycle.guard.spec.ts proves it.
    OrdersModule,
    LlmModule,
    StoreSettingsModule,
    BullModule.registerQueue(
      { name: 'listings' },
      { name: 'stock-sync' },
      { name: 'keepa-refresh' },
      { name: EBAY_FEED_SYNC_QUEUE }
    ),
  ],
  controllers: [ListingsController],
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
  ],
  exports: [ListingsService, ListingQueueService],
})
export class ListingsModule {}
