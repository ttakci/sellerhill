import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

import { ListingCleanupService } from './listing-cleanup.service';

export const LISTING_CLEANUP_QUEUE = 'listing-cleanup';

/** Hourly, off the top of the hour so it does not pile onto the other hourly ticks. */
const LISTING_CLEANUP_CRON = '23 * * * *';

/**
 * The tick behind the sellers' clean-up rules (end listings that stayed out of
 * stock, or did not sell). Concurrency 1: the sweep is sequential and capped
 * per run, and two overlapping runs would only race each other for the same
 * listings.
 *
 * The kill switch (`listing.cleanup.enabled`) is read inside the sweep on
 * every tick, never here.
 */
@Processor(LISTING_CLEANUP_QUEUE, { concurrency: 1 })
export class ListingCleanupProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ListingCleanupProcessor.name);

  constructor(
    @InjectQueue(LISTING_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly cleanup: ListingCleanupService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // A repeatable entry is keyed by its pattern, so clear ours first — a
    // changed pattern would otherwise ADD a schedule rather than replace one.
    try {
      for (const scheduler of await this.queue.getJobSchedulers()) {
        if (scheduler.key) {
          await this.queue.removeJobScheduler(scheduler.key);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to clear the listing clean-up tick: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await this.queue.add(LISTING_CLEANUP_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: LISTING_CLEANUP_CRON },
      jobId: 'listing-cleanup-tick',
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`Listing clean-up tick configured: cron="${LISTING_CLEANUP_CRON}"`);
  }

  async process(): Promise<void> {
    await this.cleanup.runSweep();
  }
}
