import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class SyncQueueService implements OnModuleInit {
  private readonly logger = new Logger(SyncQueueService.name);

  constructor(@InjectQueue('sync') private readonly syncQueue: Queue) {}

  async onModuleInit() {
    await this.setupRepeatableJobs();
  }

  /**
   * Setup production-ready repeatable jobs (Cron) using BullMQ
   */
  private async setupRepeatableJobs() {
    this.logger.log('Configuring repeatable sync jobs...');

    // 1. Price + Stock Sync (2x daily)
    // Scheduled at 09:00 and 21:00 as per requirements.
    await this.syncQueue.add(
      'sync-prices',
      {},
      {
        repeat: { pattern: '0 9,21 * * *' },
        jobId: 'price-sync-cron',
        removeOnComplete: true,
      }
    );

    // 2. Metadata Sync (1x monthly)
    // Runs on the 1st of every month at 03:00.
    await this.syncQueue.add(
      'sync-metadata',
      {},
      {
        repeat: { pattern: '0 3 1 * *' },
        jobId: 'metadata-sync-cron',
        removeOnComplete: true,
      }
    );

    // 3. Order Sync (every 15 minutes)
    // Fetches new orders from eBay for all active accounts
    await this.syncQueue.add(
      'sync-orders',
      {},
      {
        repeat: { pattern: '*/15 * * * *' },
        jobId: 'order-sync-cron',
        removeOnComplete: true,
      }
    );

    this.logger.log('Repeatable sync jobs configured.');
  }

  /**
   * Manually trigger a price sync cycle
   */
  async triggerPriceSync() {
    await this.syncQueue.add('sync-prices', { manual: true });
  }

  /**
   * Manually trigger a metadata sync cycle
   */
  async triggerMetadataSync() {
    await this.syncQueue.add('sync-metadata', { manual: true });
  }
}
