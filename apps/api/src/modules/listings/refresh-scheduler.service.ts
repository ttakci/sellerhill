import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

/**
 * Registers the stale-driven refresh tick.
 *
 * The scheduler knows nothing about Keepa. Every tick it enqueues a
 * `select-refresh-batch` job; the processor selects the most overdue products
 * and fans them out as `refresh-batch` jobs. Frequency is entirely config-driven
 * (KEEPA_REFRESH_SCHEDULER_CRON) — no code change needed to dial it up/down.
 */
@Injectable()
export class RefreshSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RefreshSchedulerService.name);

  constructor(
    @InjectQueue('keepa-refresh') private readonly refreshQueue: Queue,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    const enabled = (this.configService.get<string>('KEEPA_REFRESH_ENABLED') ?? 'true') !== 'false';
    if (!enabled) {
      // Remove any previously-registered repeatable tick so a restart with the
      // flag off genuinely stops background Keepa spend.
      this.logger.warn('KEEPA_REFRESH_ENABLED=false — Keepa refresh scheduler disabled.');
      await this.removeRepeatableTick();
      return;
    }
    await this.setupRepeatableTick();
  }

  private async removeRepeatableTick() {
    try {
      const schedulers = await this.refreshQueue.getJobSchedulers();
      for (const scheduler of schedulers) {
        if (scheduler.key) {
          await this.refreshQueue.removeJobScheduler(scheduler.key);
        }
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to remove Keepa refresh tick: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async setupRepeatableTick() {
    const cron = this.configService.get<string>('KEEPA_REFRESH_SCHEDULER_CRON') ?? '* * * * *';
    this.logger.log(`Configuring Keepa refresh tick: cron="${cron}"`);

    await this.refreshQueue.add(
      'select-refresh-batch',
      stampCurrentCorrelation({}),
      {
        repeat: { pattern: cron },
        jobId: 'keepa-refresh-tick',
        removeOnComplete: true,
      }
    );

    this.logger.log('Keepa refresh tick configured.');
  }
}
