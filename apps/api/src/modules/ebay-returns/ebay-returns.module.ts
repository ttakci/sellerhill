// apps/api/src/modules/ebay-returns/ebay-returns.module.ts

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { EbayModule } from '../ebay/ebay.module';

import { EbayCancellationsActionsService } from './ebay-cancellations-actions.service';
import { EbayCancellationsSyncService } from './ebay-cancellations-sync.service';
import { EbayCancellationsController } from './ebay-cancellations.controller';
import { EbayReturnsActionsService } from './ebay-returns-actions.service';
import { EbayReturnsSyncProcessor } from './ebay-returns-sync.processor';
import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import { EBAY_RETURNS_SYNC_QUEUE } from './ebay-returns.constants';
import { EbayReturnsController } from './ebay-returns.controller';
import { EbayReturnsService } from './ebay-returns.service';
import { PostOrderClient } from './post-order.client';
import { ReturnSweepScheduleService } from './return-sweep-schedule.service';

/**
 * eBay returns: the Post-Order client, the periodic sweep that copies each
 * store's returns into `ebay_returns`, the `returns` routes the seller's page
 * reads, and the three in-app actions (`EbayReturnsActionsService`, behind the
 * `ebay.returns.actionsEnabled` switch). Buyer cancellation requests live here
 * too — same API family, same tick: `EbayCancellationsSyncService`, the
 * `cancellations` routes and the two answers (`EbayCancellationsActionsService`,
 * behind `ebay.cancellations.actionsEnabled`).
 *
 * Imports only EbayModule (the per-store token) and BillingModule (the
 * suspension check) — EbayModule already imports BillingModule, and nothing
 * imports this module back, so it closes no cycle. `EbayCallBudgetService`
 * and `PlatformSettingsService` are global.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EbayModule,
    BillingModule,
    BullModule.registerQueue({ name: EBAY_RETURNS_SYNC_QUEUE }),
  ],
  controllers: [EbayReturnsController, EbayCancellationsController],
  providers: [
    PostOrderClient,
    ReturnSweepScheduleService,
    EbayReturnsSyncService,
    EbayReturnsSyncProcessor,
    EbayReturnsService,
    EbayReturnsActionsService,
    EbayCancellationsSyncService,
    EbayCancellationsActionsService,
  ],
  // The schedule is exported for the Action Center and the orders list, which
  // must call a return / a cancellation request stale on the very interval
  // its sweep refreshes it at.
  exports: [EbayReturnsService, ReturnSweepScheduleService],
})
export class EbayReturnsModule {}
