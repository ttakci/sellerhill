import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ProductSyncService } from './product-sync.service';

@Processor('price-sync')
export class SyncProcessorService extends WorkerHost {
  private readonly logger = new Logger(SyncProcessorService.name);

  constructor(private readonly syncService: ProductSyncService) {
    super();
  }

  async process(job: Job<{ manual?: boolean }>): Promise<void> {
    this.logger.log(`Processing price sync job: ${job.name}`);

    try {
      if (job.name === 'sync-prices') {
        await this.syncService.runSyncCycle('prices');
      } else if (job.name === 'sync-metadata') {
        await this.syncService.runSyncCycle('metadata');
      } else {
        this.logger.warn(`Unknown job name: ${job.name}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in sync processor job ${job.name}: ${message}`);
      throw error;
    }
  }
}
