// apps/api/src/modules/ebay-finances/ebay-finances.module.ts

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { EbayModule } from '../ebay/ebay.module';

import { BillingCaptureProcessor } from './billing-capture.processor';
import { BillingCaptureService } from './billing-capture.service';
import { EBAY_BILLING_SYNC_QUEUE } from './ebay-finances.constants';
import { FinancesClient } from './finances.client';

/**
 * eBay Finances API: today only the capture-only billing sweep (spec Part
 * C3). The ad-fee parser and the order columns arrive with C3, written
 * against the captured files.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EbayModule,
    BillingModule,
    BullModule.registerQueue({ name: EBAY_BILLING_SYNC_QUEUE }),
  ],
  providers: [FinancesClient, BillingCaptureService, BillingCaptureProcessor],
})
export class EbayFinancesModule {}
