import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { OrdersModule } from '../orders/orders.module';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonOrderParserService } from './amazon-order-parser.service';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingProcessorService } from './amazon-tracking-processor.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { AmazonController } from './amazon.controller';
import { BrowserStateManager } from './browser-state-manager.service';

@Module({
  imports: [
    DatabaseModule,
    EbayModule,
    OrdersModule,
    BullModule.registerQueue({ name: 'amazon-tracking' }),
  ],
  controllers: [AmazonController],
  providers: [
    BrowserStateManager,
    AmazonRateLimiter,
    AmazonAccountsService,
    AmazonScrapingService,
    AmazonOrderParserService,
    AmazonTrackingQueueService,
    AmazonTrackingProcessorService,
  ],
  exports: [AmazonAccountsService, AmazonTrackingQueueService],
})
export class AmazonModule {}
