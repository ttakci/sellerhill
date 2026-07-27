import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

/**
 * Producer for the `stock-sync` queue. Order-sync enqueues a job per confirmed
 * sale so affected listings are recomputed + pushed to eBay without waiting for
 * the 12h Keepa sync.
 *
 * Rate-limit hygiene:
 *  - jobId is bucketed by a 5s window per product, so a burst of sales for the
 *    same ASIN collapses into ONE job (the worker re-reads stock at run time, so
 *    the coalesced job reflects the latest value).
 *  - BullMQ retry with exponential backoff handles transient eBay failures.
 */
@Injectable()
export class StockSyncQueueService {
  private readonly logger = new Logger(StockSyncQueueService.name);

  /** Collapse sales within this window for the same product into one job. */
  private static readonly DEDUP_WINDOW_MS = 5000;

  constructor(@InjectQueue('stock-sync') private readonly stockSyncQueue: Queue) {}

  async enqueueProductStockSync(productId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / StockSyncQueueService.DEDUP_WINDOW_MS);
    const jobId = `stock-sync:${productId}:${bucket}`;

    await this.stockSyncQueue.add(
      'sync-product-stock',
      stampCurrentCorrelation({ productId }),
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 300 },
        removeOnFail: { age: 3600 },
      }
    );
    this.logger.debug(`Enqueued stock-sync for product ${productId} (jobId ${jobId})`);
  }
}
