// apps/api/src/modules/ebay-returns/ebay-returns.module.ts

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { EbayModule } from '../ebay/ebay.module';

import { EbayReturnsSyncProcessor } from './ebay-returns-sync.processor';
import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import { EBAY_RETURNS_SYNC_QUEUE } from './ebay-returns.constants';
import { EbayReturnsController } from './ebay-returns.controller';
import { EbayReturnsService } from './ebay-returns.service';
import { PostOrderClient } from './post-order.client';

/**
 * eBay returns (read only): the Post-Order client, the periodic sweep that
 * copies each store's returns into `ebay_returns`, and the `returns` routes
 * the seller's page reads.
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
  controllers: [EbayReturnsController],
  providers: [PostOrderClient, EbayReturnsSyncService, EbayReturnsSyncProcessor, EbayReturnsService],
  exports: [EbayReturnsService],
})
export class EbayReturnsModule {}
