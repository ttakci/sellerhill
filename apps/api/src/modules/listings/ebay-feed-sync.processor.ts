import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { EbayFeedSyncService } from './ebay-feed-sync.service';

export const EBAY_FEED_SYNC_QUEUE = 'ebay-feed-sync';

/**
 * The tick behind periodic listing reconciliation.
 *
 * Concurrency 1, deliberately. eBay meters feed TASKS separately from API
 * calls and publishes no figure for the concurrent limit (error 160024), so
 * overlapping sweeps could trip a ceiling we cannot see. The pacing lives here
 * and in `maxAccountsPerRun`; the sweep itself is already sequential.
 *
 * The master switch is re-read inside `runSweep` on every tick rather than at
 * registration, so turning the feature off in the admin panel stops the calls
 * immediately without a restart — the same rule the Keepa kill switch follows.
 */
@Processor(EBAY_FEED_SYNC_QUEUE, { concurrency: 1 })
export class EbayFeedSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EbayFeedSyncProcessor.name);

  constructor(
    @InjectQueue(EBAY_FEED_SYNC_QUEUE) private readonly queue: Queue,
    private readonly feedSync: EbayFeedSyncService,
    private readonly platformSettings: PlatformSettingsService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const cron =
      (await this.platformSettings.getString(PlatformSettingKey.EBAY_FEED_SYNC_CRON)) ??
      '*/20 * * * *';

    // A repeatable entry is keyed by its cron pattern, so changing the pattern
    // ADDS a schedule rather than replacing one. Clear ours first or the queue
    // accumulates a tick per pattern the deployment has ever used.
    await this.removeExistingTick();

    await this.queue.add(EBAY_FEED_SYNC_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: cron },
      jobId: 'ebay-feed-sync-tick',
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`eBay feed sync tick configured: cron="${cron}"`);
  }

  async process(): Promise<void> {
    await this.feedSync.runSweep();
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
        `Failed to clear the eBay feed sync tick: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
