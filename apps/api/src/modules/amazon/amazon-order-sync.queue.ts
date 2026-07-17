import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

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
   * Enqueue a per-account sync job. `jobId` is bucketed per account so a
   * burst (manual + scheduled) collapses to one in-flight job per account —
   * BullMQ dedupes by jobId until the job completes.
   */
  async enqueueAccount(accountId: string): Promise<void> {
    await this.queue.add(
      'sync-account',
      { accountId },
      {
        jobId: `acct-${accountId}`,
        removeOnComplete: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );
  }
}
