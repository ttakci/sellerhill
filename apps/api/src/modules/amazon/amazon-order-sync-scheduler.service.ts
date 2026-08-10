import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { AMAZON_ORDER_SYNC_QUEUE } from './amazon-order-sync.queue';

/**
 * Registers the repeatable auto cost-capture tick.
 *
 * Mirrors `RefreshSchedulerService` (the Keepa refresh scheduler): every tick
 * the processor (`AmazonOrderSyncProcessor`) loads all Amazon buyer accounts
 * and enqueues one `sync-account` job each. The scheduler itself knows
 * nothing about scraping or matching — it only owns the cron registration.
 *
 * CADENCE IS THE PLATFORM'S BIGGEST SCALING LEVER — read before changing it.
 * This tick costs one Playwright scrape per ACCOUNT per fire, whether or not
 * that account sold anything, so its cost is `accounts × ticks/day` and is
 * independent of order volume. At 500 accounts and ~35s per scrape the former
 * every-30-minutes default demanded ~840k browser-seconds/day against a
 * ceiling of ~432k (`AmazonRateLimiter`: 5 global concurrent × 86,400s) — a
 * permanent, unrecoverable backlog. The default is therefore every 3 hours,
 * which costs ~140k/day and fits comfortably.
 *
 * Latency is not a reason to raise it: this job only writes Amazon costs onto
 * orders that were ALREADY placed. Nothing a seller waits on runs here —
 * purchasing (`auto-fulfill`) is triggered directly from order ingest, and
 * tracking has its own per-order schedulers.
 */
@Injectable()
export class AmazonOrderSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AmazonOrderSyncSchedulerService.name);

  constructor(
    @InjectQueue(AMAZON_ORDER_SYNC_QUEUE) private readonly syncQueue: Queue,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.setupRepeatableTick();
  }

  private async setupRepeatableTick(): Promise<void> {
    // Panel override → env (AMAZON_ORDER_SYNC_CRON) → code default. Consumed
    // once at boot, so the registry marks it `requiresRestart`.
    const cron =
      (await this.platformSettings.getString(PlatformSettingKey.AMAZON_ORDER_SYNC_CRON)) ??
      '0 */3 * * *';
    this.logger.log(`Configuring Amazon order-sync tick: cron="${cron}"`);

    await this.syncQueue.add(
      'tick',
      stampCurrentCorrelation({}),
      {
        repeat: { pattern: cron },
        jobId: 'amazon-order-sync-tick',
        removeOnComplete: true,
      },
    );

    this.logger.log('Amazon order-sync tick configured.');
  }
}
