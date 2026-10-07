// apps/api/src/modules/ebay-returns/ebay-returns-sync.processor.ts

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { EbayCancellationsSyncService } from './ebay-cancellations-sync.service';
import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import {
  DEFAULT_EBAY_RETURNS_SYNC_CRON,
  EBAY_RETURNS_SYNC_QUEUE,
  EBAY_RETURNS_SYNC_TICK_JOB_ID,
} from './ebay-returns.constants';

/**
 * The tick behind the periodic return sweep — and, right after it, the buyer
 * cancellation sweep (`EbayCancellationsSyncService`, its own quota pool and
 * master switch, the same cron).
 *
 * Concurrency 1: the sweep is sequential and draws on a 5,000-calls-a-day
 * quota shared by every seller, so overlapping sweeps would only spend it
 * faster. The pacing lives in the cron and in `ebay.returnSync.maxAccountsPerRun`.
 *
 * The cron is read once, at boot (`requiresRestart` in the registry). The
 * master switch is re-read inside `sweep()` on every tick, so turning the
 * feature off in the admin panel stops the calls without a restart.
 */
@Processor(EBAY_RETURNS_SYNC_QUEUE, { concurrency: 1 })
export class EbayReturnsSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EbayReturnsSyncProcessor.name);

  constructor(
    @InjectQueue(EBAY_RETURNS_SYNC_QUEUE) private readonly queue: Queue,
    private readonly returnsSync: EbayReturnsSyncService,
    private readonly cancellationsSync: EbayCancellationsSyncService,
    private readonly platformSettings: PlatformSettingsService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const cron =
      (await this.platformSettings.getString(PlatformSettingKey.EBAY_RETURN_SYNC_CRON)) ??
      DEFAULT_EBAY_RETURNS_SYNC_CRON;

    // A repeatable entry is keyed by its cron pattern, so changing the pattern
    // ADDS a schedule rather than replacing one. Clear ours first or the queue
    // accumulates a tick per pattern the deployment has ever used.
    await this.removeExistingTick();

    await this.queue.add(EBAY_RETURNS_SYNC_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: cron },
      jobId: EBAY_RETURNS_SYNC_TICK_JOB_ID,
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`eBay returns sync tick configured: cron="${cron}"`);
  }

  async process(): Promise<void> {
    // One tick, two sweeps: a failure in either is logged and never hides the other's.
    for (const [name, sweep] of [
      ['return', () => this.returnsSync.sweep()],
      ['cancellation', () => this.cancellationsSync.sweep()],
    ] as const) {
      try {
        await sweep();
      } catch (err) {
        this.logger.error(`eBay ${name} sweep failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
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
        `Failed to clear the eBay returns sync tick: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
