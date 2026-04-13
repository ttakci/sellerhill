import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { ListingSettingsGroupModule } from '../listing-settings-groups/listing-settings-group.module';
import { OrdersModule } from '../orders/orders.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { KeepaService } from './keepa.service';
import { ListingProcessorService } from './listing-processor.service';
import { ListingQueueService } from './listing-queue.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ProductSyncService } from './product-sync.service';
import { ScraperApiService } from './scraper-api.service';
import { SyncProcessorService } from './sync-processor.service';
import { SyncQueueService } from './sync-queue.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    EbayModule,
    ListingSettingsGroupModule,
    StoreSettingsModule,
    OrdersModule,
    BullModule.registerQueue({ name: 'listings' }, { name: 'sync' }),
  ],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    ScraperApiService,
    KeepaService,
    ProductSyncService,
    SyncQueueService,
    SyncProcessorService,
    ListingProcessorService,
    ListingQueueService,
    ListingStrategyService,
  ],
  exports: [ListingsService, ListingQueueService],
})
export class ListingsModule {}
