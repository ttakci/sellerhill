import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { EbayModule } from '../ebay/ebay.module';
import { StockSyncQueueService } from '../orders/stock-sync-queue.service';

import { CampaignAdStateRepository } from './campaign-ad-state.repository';
import { CampaignReportCaptureService } from './campaign-report-capture.service';
import { EbayCampaignActionsService } from './ebay-campaign-actions.service';
import { EbayCampaignSyncProcessor } from './ebay-campaign-sync.processor';
import { EbayCampaignSyncService } from './ebay-campaign-sync.service';
import { EBAY_CAMPAIGN_SYNC_QUEUE } from './ebay-campaigns.constants';
import { EbayCampaignsController } from './ebay-campaigns.controller';
import { EbayCampaignsService } from './ebay-campaigns.service';
import { EbayMarketingClient } from './ebay-marketing.client';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EbayModule,
    BillingModule,
    BullModule.registerQueue({ name: EBAY_CAMPAIGN_SYNC_QUEUE }, { name: 'stock-sync' }),
  ],
  controllers: [EbayCampaignsController],
  providers: [
    EbayMarketingClient,
    CampaignAdStateRepository,
    EbayCampaignSyncService,
    EbayCampaignsService,
    EbayCampaignActionsService,
    EbayCampaignSyncProcessor,
    CampaignReportCaptureService,
    StockSyncQueueService,
  ],
  exports: [EbayMarketingClient, CampaignAdStateRepository, EbayCampaignSyncService],
})
export class EbayCampaignsModule {}
