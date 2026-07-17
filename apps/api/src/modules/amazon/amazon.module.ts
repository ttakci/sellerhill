import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { OrdersModule } from '../orders/orders.module';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonOrderParserService } from './amazon-order-parser.service';
import { AmazonOrderSyncSchedulerService } from './amazon-order-sync-scheduler.service';
import { AmazonOrderSyncProcessor } from './amazon-order-sync.processor';
import { AMAZON_ORDER_SYNC_QUEUE, AmazonOrderSyncQueueService } from './amazon-order-sync.queue';
import { AmazonOrderSyncService } from './amazon-order-sync.service';
import { AmazonRateLimiter } from './amazon-rate-limiter.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { AmazonTrackingProcessorService } from './amazon-tracking-processor.service';
import { AmazonTrackingQueueService } from './amazon-tracking-queue.service';
import { AmazonVerifyProcessorService } from './amazon-verify-processor.service';
import { AmazonVerifyQueueService } from './amazon-verify-queue.service';
import { AmazonController } from './amazon.controller';
import { BrowserStateManager } from './browser-state-manager.service';

@Module({
  imports: [
    DatabaseModule,
    EbayModule,
    OrdersModule,
    BullModule.registerQueue(
      { name: 'amazon-tracking' },
      { name: 'amazon-verify' },
      { name: AMAZON_ORDER_SYNC_QUEUE },
    ),
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
    AmazonVerifyQueueService,
    AmazonVerifyProcessorService,
    // Auto cost-capture (Task 7) — scrapes each Amazon account's order list,
    // matches to pending eBay orders, writes real Amazon costs. Scheduler
    // owns the repeatable tick; processor fans out one job per account;
    // service owns scrape → match → write → recompute.
    AmazonOrderSyncService,
    AmazonOrderSyncProcessor,
    AmazonOrderSyncQueueService,
    AmazonOrderSyncSchedulerService,
  ],
  exports: [
    AmazonAccountsService,
    AmazonTrackingQueueService,
    AmazonVerifyQueueService,
    AmazonOrderSyncQueueService,
  ],
})
export class AmazonModule {}
