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
 * One WAITING-OR-ACTIVE job per eBay order, through BullMQ `deduplication` —
 * NEVER a fixed `jobId`. BullMQ silently ignores an add whose jobId a KEPT job
 * still holds, and `removeOnComplete: 100` keeps completed jobs: an order that
 * was blocked at execution (its job completed) and later re-armed by the
 * suspension-resume or unpaid-recheck sweep was "enqueued" into nothing and sat
 * at PENDING ("buying") for ever. `deduplication` releases the id when the job
 * finishes. Double-purchase safety does not rest on the id at all: it rests on
 * the click stamp and the status re-check in the checkout. The queue name +
 * id prefix live in `auto-fulfill-queue.constants.ts` (shared with the
 * consumer) so a rename can never silently detach the worker from the queue.
 */
export { AUTO_FULFILL_QUEUE };

@Injectable()
export class AutoFulfillQueueService {
  private readonly logger = new Logger(AutoFulfillQueueService.name);

  constructor(@InjectQueue(AUTO_FULFILL_QUEUE) private readonly queue: Queue) {}

  async enqueue(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    await this.queue.add(
      'fulfill-order',
      stampCurrentCorrelation({ ebayOrderId, amazonAccountId }),
      {
        deduplication: { id: `${AUTO_FULFILL_JOB_ID_PREFIX}${ebayOrderId}` },
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
   *
   * `manual: true` travels with the job: the seller asked for THIS order, so
   * the pre-purchase check does not hold it for an open cancel request (it
   * still refuses a cancelled, shipped or multi-item sale).
   */
  async enqueueManual(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    await this.queue.add(
      'fulfill-order',
      stampCurrentCorrelation({ ebayOrderId, amazonAccountId, manual: true }),
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
