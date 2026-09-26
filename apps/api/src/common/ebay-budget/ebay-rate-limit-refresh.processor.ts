import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { EbayAnalyticsService } from './ebay-analytics.service';

export const EBAY_RATE_LIMIT_REFRESH_QUEUE = 'ebay-rate-limit-refresh';
const REFRESH_JOB = 'refresh-ebay-rate-limits';
/** Hourly is ample: ceilings change on an Application Growth Check approval, which is rare. */
const REFRESH_CRON = '7 * * * *';

/**
 * Keeps the stored eBay limits current: once at boot, then hourly.
 *
 * A failed refresh changes nothing — the governor keeps using the last value
 * eBay gave (spec D2).
 */
@Processor(EBAY_RATE_LIMIT_REFRESH_QUEUE, { concurrency: 1 })
@Injectable()
export class EbayRateLimitRefreshProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EbayRateLimitRefreshProcessor.name);

  constructor(
    @InjectQueue(EBAY_RATE_LIMIT_REFRESH_QUEUE) private readonly queue: Queue,
    private readonly analytics: EbayAnalyticsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        REFRESH_JOB,
        {},
        {
          repeat: { pattern: REFRESH_CRON },
          jobId: 'ebay-rate-limit-refresh-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(`Failed to schedule eBay rate-limit refresh: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Boot fetch, not awaited: a slow eBay must not delay startup.
    void this.analytics.refresh();
  }

  async process(job: Job): Promise<{ refreshed: boolean }> {
    if (job.name !== REFRESH_JOB) {
      return { refreshed: false };
    }
    return { refreshed: await this.analytics.refresh() };
  }
}
