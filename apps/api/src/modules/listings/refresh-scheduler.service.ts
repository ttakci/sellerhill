import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

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
    await this.setupRepeatableTick();
  }

  private async setupRepeatableTick() {
    const cron = this.configService.get<string>('KEEPA_REFRESH_SCHEDULER_CRON') ?? '* * * * *';
    this.logger.log(`Configuring Keepa refresh tick: cron="${cron}"`);

    await this.refreshQueue.add(
      'select-refresh-batch',
      {},
      {
        repeat: { pattern: cron },
        jobId: 'keepa-refresh-tick',
        removeOnComplete: true,
      }
    );

    this.logger.log('Keepa refresh tick configured.');
  }
}
