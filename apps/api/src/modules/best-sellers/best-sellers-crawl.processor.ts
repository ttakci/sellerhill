import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

import { BestSellersCrawlService } from './best-sellers-crawl.service';

export const BEST_SELLERS_CRAWL_QUEUE = 'best-sellers-crawl';

/** Every minute: `pagesPerMinute` IS the per-tick budget. */
const BEST_SELLERS_CRAWL_CRON = '* * * * *';

/**
 * The tick behind the platform's Best Sellers tree crawl and list pre-warm.
 * Concurrency 1: a tick that runs long delays the next one instead of
 * doubling the crawl's share of the proxy pool.
 *
 * Every switch (`bestSellers.enabled`, `bestSellers.crawl.*`,
 * `bestSellers.prewarm.*`) is read inside the tick, never here.
 */
@Processor(BEST_SELLERS_CRAWL_QUEUE, { concurrency: 1 })
export class BestSellersCrawlProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BestSellersCrawlProcessor.name);

  constructor(
    @InjectQueue(BEST_SELLERS_CRAWL_QUEUE) private readonly queue: Queue,
    private readonly crawl: BestSellersCrawlService,
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
      this.logger.warn(`Failed to clear the Best Sellers crawl tick: ${err instanceof Error ? err.message : String(err)}`);
    }

    await this.queue.add(BEST_SELLERS_CRAWL_QUEUE, stampCurrentCorrelation({}), {
      repeat: { pattern: BEST_SELLERS_CRAWL_CRON },
      jobId: 'best-sellers-crawl-tick',
      removeOnComplete: true,
      removeOnFail: 50,
    });
    this.logger.log(`Best Sellers crawl tick configured: cron="${BEST_SELLERS_CRAWL_CRON}"`);
  }

  async process(): Promise<void> {
    await this.crawl.runTick();
  }
}
