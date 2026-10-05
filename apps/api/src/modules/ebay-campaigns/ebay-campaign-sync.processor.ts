// apps/api/src/modules/ebay-campaigns/ebay-campaign-sync.processor.ts

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { CampaignReportCaptureService } from './campaign-report-capture.service';
import { EbayCampaignSyncService } from './ebay-campaign-sync.service';
import {
  DEFAULT_EBAY_CAMPAIGN_SYNC_CRON,
  EBAY_CAMPAIGN_SYNC_QUEUE,
  EBAY_CAMPAIGN_SYNC_TICK_JOB_ID,
} from './ebay-campaigns.constants';

/**
 * The tick behind the campaign sync. Concurrency 1: the sweep is sequential
 * and the cron only decides how often a few more due stores are picked up;
 * how often one store is read is `ebay.campaignSync.intervalHours`.
 * The switch is re-read inside `runSweep` on every tick.
 */
@Processor(EBAY_CAMPAIGN_SYNC_QUEUE, { concurrency: 1 })
export class EbayCampaignSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EbayCampaignSyncProcessor.name);

  constructor(
    @InjectQueue(EBAY_CAMPAIGN_SYNC_QUEUE) private readonly queue: Queue,
    private readonly sync: EbayCampaignSyncService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly reports: CampaignReportCaptureService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const cron =
      (await this.platformSettings.getString(PlatformSettingKey.EBAY_CAMPAIGN_SYNC_CRON)) ??
      DEFAULT_EBAY_CAMPAIGN_SYNC_CRON;

    // A repeatable entry is keyed by its cron pattern, so changing the pattern
    // ADDS a schedule rather than replacing one. Clear ours first.
    await this.removeExistingTick();

    await this.queue.add(EBAY_CAMPAIGN_SYNC_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: cron },
      jobId: EBAY_CAMPAIGN_SYNC_TICK_JOB_ID,
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`eBay campaign sync tick configured: cron="${cron}"`);
  }

  async process(): Promise<void> {
    await this.sync.runSweep();
    await this.reports.runSweep();
  }

  private async removeExistingTick(): Promise<void> {
    try {
      for (const scheduler of await this.queue.getJobSchedulers()) {
        if (scheduler.key) {
          await this.queue.removeJobScheduler(scheduler.key);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to clear the eBay campaign sync tick: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
