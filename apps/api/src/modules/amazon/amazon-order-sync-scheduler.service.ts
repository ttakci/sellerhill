import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AMAZON_ORDER_SYNC_QUEUE } from './amazon-order-sync.queue';

/**
 * Registers the repeatable auto cost-capture tick.
 *
 * Mirrors `RefreshSchedulerService` (the Keepa refresh scheduler): every tick
 * the processor (`AmazonOrderSyncProcessor`) loads all Amazon buyer accounts
 * and enqueues one `sync-account` job each. The scheduler itself knows
 * nothing about scraping or matching — it only owns the cron registration.
 *
 * Cadence is config-driven (AMAZON_ORDER_SYNC_CRON) — no code change needed
 * to dial it up/down.
 */
@Injectable()
export class AmazonOrderSyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AmazonOrderSyncSchedulerService.name);

  constructor(
    @InjectQueue(AMAZON_ORDER_SYNC_QUEUE) private readonly syncQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.setupRepeatableTick();
  }

  private async setupRepeatableTick(): Promise<void> {
    const cron =
      this.configService.get<string>('AMAZON_ORDER_SYNC_CRON') ?? '*/30 * * * *';
    this.logger.log(`Configuring Amazon order-sync tick: cron="${cron}"`);

    await this.syncQueue.add(
      'tick',
      {},
      {
        repeat: { pattern: cron },
        jobId: 'amazon-order-sync-tick',
        removeOnComplete: true,
      },
    );

    this.logger.log('Amazon order-sync tick configured.');
  }
}
