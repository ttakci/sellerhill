import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { extractCorrelationId, generateCorrelationId } from '@repo/shared';
import { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

import { AMAZON_ORDER_SYNC_QUEUE } from './amazon-order-sync.queue';
import { AmazonOrderSyncService } from './amazon-order-sync.service';

// Worker concurrency applied at decoration time (ConfigService not available
// in decorator metadata — read env directly, same pattern as RefreshProcessor).
const SYNC_CONCURRENCY = Math.max(1, Number(process.env.AMAZON_ORDER_SYNC_CONCURRENCY) || 2);

interface SyncAccountJobData {
  accountId: string;
}

interface TickJobData {
  // empty — tick has no payload, just fans out per-account jobs
}

/**
 * Auto cost-capture worker. Two job names share one queue (mirror the
 * `keepa-refresh` pattern):
 *  - `tick`           → repeatable scheduler tick: load every Amazon account,
 *                       enqueue one `sync-account` job per account.
 *  - `sync-account`   → per-account cost-capture (scrape → match → write →
 *                       recompute). Transport failures bubble so BullMQ
 *                       exponential backoff retries the whole account.
 */
@Processor(AMAZON_ORDER_SYNC_QUEUE, { concurrency: SYNC_CONCURRENCY })
export class AmazonOrderSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AmazonOrderSyncProcessor.name);

  constructor(
    @InjectQueue(AMAZON_ORDER_SYNC_QUEUE) private readonly syncQueue: Queue,
    private readonly databaseService: DatabaseService,
    private readonly syncService: AmazonOrderSyncService,
  ) {
    super();
  }

  async process(job: Job<SyncAccountJobData | TickJobData>): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: AMAZON_ORDER_SYNC_QUEUE,
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        if (job.name === 'tick') {
          await this.handleTick();
        } else if (job.name === 'sync-account') {
          const { accountId } = job.data as SyncAccountJobData;
          this.logger.debug(`syncing Amazon orders for account ${accountId}`);
          await this.syncService.runForAccount(accountId);
        } else {
          this.logger.warn(`Unknown ${AMAZON_ORDER_SYNC_QUEUE} job name: ${job.name}`);
        }
      }
    );
  }

  /**
   * Scheduler tick: load every active Amazon account and enqueue one
   * `sync-account` job each. Per-account `jobId` dedupes against any
   * in-flight manual enqueue so overlapping ticks collapse cleanly.
   */
  private async handleTick(): Promise<void> {
    const accounts = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM amazon_accounts ORDER BY id`,
    );
    if (accounts.length === 0) {
      this.logger.debug('No Amazon accounts — skipping sync tick.');
      return;
    }

    this.logger.log(`Scheduler tick: enqueuing sync for ${accounts.length} Amazon account(s).`);
    for (const account of accounts) {
      try {
        await this.syncQueue.add(
          'sync-account',
          stampCurrentCorrelation({ accountId: account.id }),
          {
            jobId: `acct-${account.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: 100,
          },
        );
      } catch (err) {
        // BullMQ enqueue failure for one account shouldn't block the rest.
        this.logger.warn(
          `Failed to enqueue sync for account ${account.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
