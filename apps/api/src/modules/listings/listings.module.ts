import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { ListingSettingsGroupModule } from '../listing-settings-groups/listing-settings-group.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
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
    ConfigModule,
    EbayModule,
    ListingSettingsGroupModule,
    StoreSettingsModule,
    BullModule.registerQueue(
      { name: 'listings' },
      { name: 'stock-sync' },
      { name: 'keepa-refresh' }
    ),
  ],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    KeepaService,
    KeepaUsageService,
    ProductSyncService,
    RefreshSchedulerService,
    RefreshProcessorService,
    ListingProcessorService,
    ListingQueueService,
    ListingStrategyService,
    StockSyncProcessorService,
  ],
  exports: [ListingsService, ListingQueueService],
})
export class ListingsModule {}
