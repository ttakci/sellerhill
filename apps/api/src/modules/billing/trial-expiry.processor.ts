import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { BillingRepositoryService } from './billing-repository.service';

export const BILLING_TRIAL_EXPIRY_QUEUE = 'billing-trial-expiry';
const BILLING_TRIAL_EXPIRY_JOB = 'expire-trials';
const DEFAULT_EXPIRY_CRON = '23 2 * * *';

/**
 * Daily idempotent trial closer. Existing listings are deliberately untouched:
 * trial expiry is a downgrade, and billing's contract blocks future create/
 * publish only when enforcement is enabled.
 */
@Processor(BILLING_TRIAL_EXPIRY_QUEUE, { concurrency: 1 })
@Injectable()
export class TrialExpiryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TrialExpiryProcessor.name);

  constructor(
    @InjectQueue(BILLING_TRIAL_EXPIRY_QUEUE) private readonly queue: Queue,
    private readonly repository: BillingRepositoryService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        BILLING_TRIAL_EXPIRY_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_EXPIRY_CRON },
          jobId: 'billing-trial-expiry-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule billing trial expiry: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async process(job: Job): Promise<{ expired: number }> {
    if (job.name !== BILLING_TRIAL_EXPIRY_JOB) {
      return { expired: 0 };
    }
    const expired = await this.repository.expireElapsedTrials();
    this.logger.log(`Expired ${expired} billing trial(s).`);
    return { expired };
  }
}
