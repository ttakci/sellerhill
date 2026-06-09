import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class SyncQueueService implements OnModuleInit {
  private readonly logger = new Logger(SyncQueueService.name);

  constructor(@InjectQueue('price-sync') private readonly priceSyncQueue: Queue) {}

  async onModuleInit() {
    await this.setupRepeatableJobs();
  }

  private async setupRepeatableJobs() {
    this.logger.log('Configuring price sync repeatable jobs...');

    // Price + Stock Sync (2x daily) — Keepa API token budget constraint
    await this.priceSyncQueue.add(
      'sync-prices',
      {},
      {
        repeat: { pattern: '0 9,21 * * *' },
        jobId: 'price-sync-cron',
        removeOnComplete: true,
      }
    );

    // Metadata Sync (1x monthly)
    await this.priceSyncQueue.add(
      'sync-metadata',
      {},
      {
        repeat: { pattern: '0 3 1 * *' },
        jobId: 'metadata-sync-cron',
        removeOnComplete: true,
      }
    );

    this.logger.log('Price sync repeatable jobs configured.');
  }

  async triggerPriceSync() {
    await this.priceSyncQueue.add('sync-prices', { manual: true });
  }

  async triggerMetadataSync() {
    await this.priceSyncQueue.add('sync-metadata', { manual: true });
  }
}
