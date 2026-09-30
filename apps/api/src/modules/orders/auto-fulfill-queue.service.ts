import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import {
  AUTO_FULFILL_JOB_ID_PREFIX,
  AUTO_FULFILL_QUEUE,
} from '../amazon/auto-fulfill-queue.constants';

/**
 * Producer for the `auto-fulfill` queue. The producer (OrderSyncService, this
 * module) enqueues one job per brand-new matched eBay order when the user has
 * the master toggle on and a round-robin-eligible Amazon account exists.
 *
 * The consumer (Task 8 processor) lives in the Amazon module and connects to
 * the same Redis queue BY NAME — BullMQ workers need no `registerQueue` on the
 * consumer side. Keeping the queue registered in OrdersModule avoids a circular
 * module dep (AmazonModule already imports OrdersModule for `recomputeProfit`).
 *
 * `jobId` is keyed per eBay order id so BullMQ dedupes across retries: one
 * fulfillment attempt per order, even if the producer fires twice or the
 * processor exhausts its attempts and the queue is re-enqueued. The queue name
 * + jobId prefix live in `auto-fulfill-queue.constants.ts` (shared with the
 * consumer) so a rename can never silently detach the worker from the queue.
 */
export { AUTO_FULFILL_QUEUE };

@Injectable()
export class AutoFulfillQueueService {
  private readonly logger = new Logger(AutoFulfillQueueService.name);

  constructor(@InjectQueue(AUTO_FULFILL_QUEUE) private readonly queue: Queue) {}

  async enqueue(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    // jobId per order => dedup; one fulfillment attempt per order across BullMQ retries.
    await this.queue.add(
      'fulfill-order',
      stampCurrentCorrelation({ ebayOrderId, amazonAccountId }),
      {
        jobId: `${AUTO_FULFILL_JOB_ID_PREFIX}${ebayOrderId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: { age: 86_400 },
      },
    );
    this.logger.log(
      `enqueued auto-fulfill for ${ebayOrderId} on account ${amazonAccountId}`,
    );
  }

  /**
   * The seller's "Start automatic order" click. Needs its OWN jobId: the
   * per-order id above is kept on completed/failed jobs (removeOnComplete /
   * removeOnFail), and BullMQ silently ignores an add whose id already exists —
   * the click would enqueue nothing. Duplicate protection does not rest on the
   * id here: `OrderSyncService.startAutoFulfillManually` claims the row with a
   * compare-and-set first, so only one click per blocked state reaches this.
   */
  async enqueueManual(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    await this.queue.add(
      'fulfill-order',
      stampCurrentCorrelation({ ebayOrderId, amazonAccountId }),
      {
        jobId: `${AUTO_FULFILL_JOB_ID_PREFIX}${ebayOrderId}-manual-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: { age: 86_400 },
      },
    );
    this.logger.log(
      `enqueued manual auto-fulfill for ${ebayOrderId} on account ${amazonAccountId}`,
    );
  }
}
