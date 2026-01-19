import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { ListingSettingsGroupModule } from '../listing-settings-groups/listing-settings-group.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';
import { ListingProcessorService } from './listing-processor.service';
import { ListingQueueService } from './listing-queue.service';
import { ListingStrategyService } from './listing-strategy.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ScraperApiService } from './scraper-api.service';

@Module({
  imports: [
    DatabaseModule, 
    ConfigModule, 
    EbayModule,
    ListingSettingsGroupModule,
    StoreSettingsModule,
    BullModule.registerQueue({
      name: 'listings',
    }),
  ],
  controllers: [ListingsController],
  providers: [
    ListingsService, 
    ScraperApiService, // Active product data provider
    ListingProcessorService, 
    ListingQueueService,
    ListingStrategyService,
  ],
  exports: [ListingsService, ListingQueueService],
})
export class ListingsModule {}
