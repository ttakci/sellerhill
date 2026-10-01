import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

/**
 * Internal queue name — BullMQ queue string (not a domain status). Kept here
 * so the queue service, processor, scheduler, and module registration all
 * reference the same constant.
 */
export const AMAZON_ORDER_SYNC_QUEUE = 'amazon-order-sync';

/**
 * Producer for the auto cost-capture queue. Exposes `enqueueAccount` so other
 * modules (or a future admin controller) can trigger an immediate sync for a
 * specific Amazon account outside the repeatable scheduler tick.
 */
@Injectable()
export class AmazonOrderSyncQueueService {
  private readonly logger = new Logger(AmazonOrderSyncQueueService.name);

  constructor(
    @InjectQueue(AMAZON_ORDER_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Enqueue a per-account sync job. A burst (manual + scheduled) collapses to
   * one waiting/active job per account through BullMQ deduplication, which
   * releases the id once the job finishes. Never a fixed `jobId`: BullMQ drops
   * an add whose id a kept completed job still holds — that stopped this queue
   * for a week (see the processor).
   */
  async enqueueAccount(accountId: string, opts: { delayMs?: number } = {}): Promise<void> {
    const delayed = typeof opts.delayMs === 'number' && opts.delayMs > 0;
    await this.queue.add(
      'sync-account',
      stampCurrentCorrelation({ accountId }),
      {
        // A delayed run (the look for an order a few minutes after a Place
        // Order click) gets its OWN deduplication id. Sharing the scheduled
        // tick's id would drop it whenever a tick's job for the account was
        // already waiting or running — and that earlier scan would read the
        // order list before the new order appeared on it.
        deduplication: { id: `acct-${accountId}${delayed ? '-after-click' : ''}` },
        ...(delayed ? { delay: opts.delayMs } : {}),
        removeOnComplete: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
  }
}
