import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { BuyerMessagingModule } from '../buyer-messaging/buyer-messaging.module';
import { EbayModule } from '../ebay/ebay.module';
import { OrdersModule } from '../orders/orders.module';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonCheckoutService } from './amazon-checkout.service';
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
import { AquilineClient } from './aquiline.client';
import { AutoFulfillProcessor } from './auto-fulfill-processor.service';
import { BrowserProfileGcService } from './browser-profile-gc.service';
import { BrowserStateManager } from './browser-state-manager.service';
import { ProxyService } from './proxy.service';
import { TrackingConversionService } from './tracking-conversion.service';
import { TrackingWebhookController } from './tracking-webhook.controller';
import { TrackingWebhookService } from './tracking-webhook.service';

@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    BuyerMessagingModule,
    EbayModule,
    OrdersModule,
    BullModule.registerQueue(
      { name: 'amazon-tracking' },
      { name: 'amazon-verify' },
      { name: AMAZON_ORDER_SYNC_QUEUE },
    ),
  ],
  controllers: [AmazonController, TrackingWebhookController],
  providers: [
    // Per-account persistent + proxy-aware browser context manager.
    // Resolves sticky residential proxy per Zonds user (or per account) and
    // launches contexts that share a per-account user-data-dir.
    ProxyService,
    BrowserStateManager,
    AmazonRateLimiter,
    // Bounds profile DISK the way BrowserStateManager.evictIdle bounds memory:
    // prunes each account's disposable Chromium caches (login preserved) and
    // removes profiles for accounts that no longer exist. Without it a
    // user_data_dir grows without limit — 50–250 GB at 500 accounts.
    BrowserProfileGcService,
    AmazonAccountsService,
    AmazonScrapingService,
    AmazonOrderParserService,
    AmazonTrackingQueueService,
    AmazonTrackingProcessorService,
    // Tracking-number conversion (Aquiline). The converter decides what the
    // eBay BUYER sees; the webhook receiver is what lets delivery detection
    // stop costing Playwright time once a conversion exists.
    AquilineClient,
    TrackingConversionService,
    TrackingWebhookService,
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
    // A2 auto-fulfillment (Task 6) — step-structured Playwright checkout with
    // review-step hard cap, dry-run mode, and fail-closed typed blocked
    // reasons. BullMQ processor (Task 8) calls runForOrder; runForOrder is
    // idempotent and re-checks auto_fulfill_status to prevent double ordering.
    AmazonCheckoutService,
    // Task 8 — drains the `auto-fulfill` queue (produced in OrdersModule,
    // Task 5). Worker connects to Redis by name; no `registerQueue` needed on
    // the consumer side. Idempotency + jobId dedup keep retries safe.
    AutoFulfillProcessor,
  ],
  exports: [
    AmazonAccountsService,
    AmazonTrackingQueueService,
    AmazonVerifyQueueService,
    AmazonOrderSyncQueueService,
    ProxyService,
  ],
})
export class AmazonModule {}
