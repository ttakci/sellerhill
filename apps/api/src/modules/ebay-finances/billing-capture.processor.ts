// apps/api/src/modules/ebay-finances/billing-capture.processor.ts

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { BillingCaptureService } from './billing-capture.service';
import {
  DEFAULT_EBAY_BILLING_SYNC_CRON,
  EBAY_BILLING_SYNC_QUEUE,
  EBAY_BILLING_SYNC_TICK_JOB_ID,
} from './ebay-finances.constants';

/**
 * The tick behind the billing capture. Concurrency 1: the sweep is sequential
 * and the cron only decides how often a few more due stores are picked up;
 * how often one store is read is `ebay.finances.billingSync.intervalHours`.
 * The switch is re-read inside `runSweep` on every tick.
 */
@Processor(EBAY_BILLING_SYNC_QUEUE, { concurrency: 1 })
export class BillingCaptureProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BillingCaptureProcessor.name);

  constructor(
    @InjectQueue(EBAY_BILLING_SYNC_QUEUE) private readonly queue: Queue,
    private readonly capture: BillingCaptureService,
    private readonly platformSettings: PlatformSettingsService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const cron =
      (await this.platformSettings.getString(PlatformSettingKey.EBAY_BILLING_SYNC_CRON)) ??
      DEFAULT_EBAY_BILLING_SYNC_CRON;

    // A repeatable entry is keyed by its cron pattern, so changing the pattern
    // ADDS a schedule rather than replacing one. Clear ours first.
    await this.removeExistingTick();

    await this.queue.add(EBAY_BILLING_SYNC_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: cron },
      jobId: EBAY_BILLING_SYNC_TICK_JOB_ID,
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`eBay billing capture tick configured: cron="${cron}"`);
  }

  async process(): Promise<void> {
    await this.capture.runSweep();
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
        `Failed to clear the eBay billing capture tick: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
