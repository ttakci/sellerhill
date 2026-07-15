import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ProductSyncService } from './product-sync.service';

/**
 * Consumes the `stock-sync` queue. Each job carries a productId whose cached
 * Amazon stock just changed (e.g. a confirmed sale decremented it). The worker
 * recomputes quantity from the LATEST stock and pushes every active listing
 * sharing that product to eBay (per each listing's own settings group).
 *
 * Idempotent by design: it re-reads stock at execution time, so delayed or
 * coalesced jobs just re-push the correct current value. Concurrency is bounded
 * (3) and eBay calls are rate-limit-protected inside EbayService.
 */
interface StockSyncJobData {
  productId: string;
}

@Processor('stock-sync', { concurrency: 3 })
export class StockSyncProcessorService extends WorkerHost {
  private readonly logger = new Logger(StockSyncProcessorService.name);

  constructor(private readonly productSyncService: ProductSyncService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { productId } = job.data as StockSyncJobData;
    this.logger.debug(`Processing stock-sync for product ${productId} (job ${job.id})`);
    try {
      await this.productSyncService.syncListingsForProduct(productId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`stock-sync failed for product ${productId}: ${message}`);
      throw error; // BullMQ will retry with backoff
    }
  }
}
