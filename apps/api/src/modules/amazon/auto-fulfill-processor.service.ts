import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AutoFulfillStatus } from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

import { AmazonCheckoutService } from './amazon-checkout.service';

// Same queue name as the producer in OrdersModule (Task 5) — one Redis queue,
// two modules. BullMQ workers need NO `registerQueue` on the consumer side:
// they connect by name. The producer's `jobId: fulfill-${ebayOrderId}` is the
// I-4 dedup guarantee that two processors never run the same order
// concurrently — `concurrency` below is across DIFFERENT orders.
export const AUTO_FULFILL_QUEUE = 'auto-fulfill';

interface AutoFulfillJobData {
  ebayOrderId: string;
  amazonAccountId: string;
}

/**
 * Drains the `auto-fulfill` queue (produced by `AutoFulfillQueueService` in
 * OrdersModule). One BullMQ worker per API process; `concurrency` is across
 * distinct orders (the producer's per-order `jobId` dedupes retries for the
 * SAME order — see I-4).
 *
 * Fail-closed retry semantics:
 *  - `AmazonCheckoutService.runForOrder` catches its own
 *    `AutoFulfillBlockedError` (captcha / cap / out-of-stock / otp / login /
 *    address / payment / no_confirmation), marks the order `blocked`, and
 *    returns WITHOUT throwing. Blocked orders therefore never reach this
 *    processor's catch block — BullMQ does not retry them.
 *  - Any error that DOES reach the catch is a transport/infra failure
 *    (Playwright crash, network, DB). Rethrow → BullMQ exponential backoff
 *    retries the job (attempts: 3 from Task 5).
 *  - On the FINAL attempt, mark `auto_fulfill_status = 'failed'` BEFORE
 *    rethrowing so the row is not left at `running` once BullMQ gives up.
 *
 * Double-run safety (I-4): the producer enqueues with
 * `jobId: fulfill-${ebayOrderId}` so BullMQ collapses any duplicate enqueue
 * for the same order into a single active job. The checkout's own
 * `shouldSkipFulfillStart` re-check (re-reads `auto_fulfill_status` on start)
 * is the second guard — together they make a retry safe even if a previous
 * attempt already reached a terminal state.
 */
@Processor(AUTO_FULFILL_QUEUE, {
  concurrency: Math.max(1, Number(process.env.AUTO_FULFILL_QUEUE_CONCURRENCY) || 1),
})
export class AutoFulfillProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoFulfillProcessor.name);

  constructor(
    private readonly checkout: AmazonCheckoutService,
    private readonly db: DatabaseService,
  ) {
    super();
  }

  // NOTE: installed `@nestjs/bullmq@11.0.4` WorkerHost declares `abstract
  // process`, not `handle` (despite newer docs sometimes showing `handle`).
  // All sibling processors in this repo use `process`; the brief's logic is
  // preserved verbatim, only the method name differs.
  async process(job: Job<AutoFulfillJobData>): Promise<void> {
    const { ebayOrderId, amazonAccountId } = job.data;
    this.logger.log(`processing fulfill ${ebayOrderId} (attempt ${job.attemptsMade + 1})`);
    try {
      await this.checkout.runForOrder(ebayOrderId, amazonAccountId);
    } catch (err) {
      // Transport/infra error — BullMQ retries (attempts: 3 from Task 5).
      // On the final attempt, mark `failed` so the row is not stuck at
      // `running` once retries exhaust. Blocked errors never reach here
      // (the checkout runner catches them internally and returns cleanly).
      const isLast = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (isLast) {
        this.logger.error(`fulfill failed (final) ${ebayOrderId}: ${(err as Error).message}`);
        await this.db.query(
          `UPDATE orders SET auto_fulfill_status = $1, updated_at = CURRENT_TIMESTAMP WHERE ebay_order_id = $2`,
          [AutoFulfillStatus.FAILED, ebayOrderId],
        );
      }
      throw err; // let BullMQ apply backoff/retry (or give up on final attempt)
    }
  }
}
