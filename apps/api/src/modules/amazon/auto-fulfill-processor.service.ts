import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AutoFulfillEvent, AutoFulfillStatus, extractCorrelationId, generateCorrelationId } from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { AutoFulfillEventLog } from '../orders/auto-fulfill-event-log.service';

import { AmazonCheckoutService } from './amazon-checkout.service';
import { AUTO_FULFILL_QUEUE } from './auto-fulfill-queue.constants';

interface AutoFulfillJobData {
  ebayOrderId: string;
  amazonAccountId: string;
  /** Set by the seller's "Start automatic order" click (`enqueueManual`). */
  manual?: boolean;
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
 *  - NEITHER write may touch a row whose Place Order click was stamped
 *    (`orders.auto_fulfill_submitted_at`): the Amazon order may exist, so the
 *    row is settled as an unknown outcome instead and the job ends WITHOUT a
 *    retry. Both UPDATEs also carry `auto_fulfill_submitted_at IS NULL` — the
 *    predicate, not the check before it, is what makes this structural.
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
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly events: AutoFulfillEventLog,
  ) {
    super();
  }

  // NOTE: installed `@nestjs/bullmq@11.0.4` WorkerHost declares `abstract
  // process`, not `handle` (despite newer docs sometimes showing `handle`).
  // All sibling processors in this repo use `process`; the brief's logic is
  // preserved verbatim, only the method name differs.
  async process(job: Job<AutoFulfillJobData>): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: AUTO_FULFILL_QUEUE,
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        const { ebayOrderId, amazonAccountId } = job.data;
        this.logger.log(`processing fulfill ${ebayOrderId} (attempt ${job.attemptsMade + 1})`);
        try {
          await this.checkout.runForOrder(ebayOrderId, amazonAccountId, { manual: job.data.manual === true });
        } catch (err) {
          // THE CLICK BOUNDARY, seen from here. If the Place Order click was
          // stamped, this error escaped AFTER money may have moved: the row is
          // settled as an unknown outcome and the job ends — no PENDING reset,
          // no FAILED, no retry. A failure of this check itself falls through
          // to the writes below, which carry the same condition in SQL.
          const clickWasSent = await this.checkout
            .settleIfClickWasSent(
              ebayOrderId,
              amazonAccountId,
              `an error escaped the checkout after the Place Order click: ${(err as Error).message}`,
            )
            .catch((settleErr: unknown) => {
              this.logger.error(
                `could not check the click stamp for ${ebayOrderId}: ${(settleErr as Error).message}`,
              );
              return false;
            });
          if (clickWasSent) {
            this.logger.error(
              `fulfill ${ebayOrderId}: error after the Place Order click — settled as unknown outcome, not retried: ${
                (err as Error).message
              }`,
              (err as Error).stack,
            );
            return;
          }
          const isLast = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
          await this.events.record(ebayOrderId, isLast ? AutoFulfillEvent.FAILED : AutoFulfillEvent.RETRY_SCHEDULED, {
            amazonAccountId,
            detail: { attempt: job.attemptsMade + 1, error: (err as Error).message.slice(0, 300) },
          });
          if (isLast) {
            const failedErr = err as Error;
            this.logger.error(
              `fulfill failed (final) ${ebayOrderId}: ${failedErr.message}`,
              failedErr.stack,
            );
            try {
              await this.db.query(
                `UPDATE orders SET auto_fulfill_status = $1, updated_at = CURRENT_TIMESTAMP
                  WHERE ebay_order_id = $2 AND auto_fulfill_submitted_at IS NULL`,
                [AutoFulfillStatus.FAILED, ebayOrderId],
              );
            } catch (markErr) {
              this.logger.warn(
                `failed to mark order ${ebayOrderId} as FAILED: ${(markErr as Error).message} — row stays at running`,
              );
            }
            // AO quota: release the reserved slot on final transport failure —
            // the order will not place, so it must not hold a monthly slot.
            // Best-effort + idempotent; userId resolved via a lookup.
            try {
              const rows = await this.db.query<{ user_id: string }>(
                `SELECT user_id FROM orders WHERE ebay_order_id = $1`,
                [ebayOrderId],
              );
              if (rows[0]?.user_id) {
                await this.quotaEnforcement.releaseAmazonOrder(rows[0].user_id, ebayOrderId);
              }
            } catch (releaseErr) {
              this.logger.warn(
                `final-fail quota release failed for ${ebayOrderId}: ${(releaseErr as Error).message}`,
              );
            }
          } else {
            // Hand the row back as PENDING before BullMQ retries, so the order
            // reads "buying" (queued) rather than "running" while it waits out
            // the backoff. The retry is safe to re-enter: the row carries no
            // click stamp, so nothing was bought. If this write fails the row
            // stays RUNNING without a stamp, which the next attempt re-enters
            // just the same (`decideFulfillStart`).
            try {
              await this.db.query(
                `UPDATE orders SET auto_fulfill_status = $1, updated_at = CURRENT_TIMESTAMP
                  WHERE ebay_order_id = $2 AND auto_fulfill_submitted_at IS NULL`,
                [AutoFulfillStatus.PENDING, ebayOrderId],
              );
            } catch (resetErr) {
              this.logger.warn(
                `could not reset ${ebayOrderId} to pending before retry: ${(resetErr as Error).message}`,
              );
            }
          }
          throw err;
        }
      }
    );
  }
}
