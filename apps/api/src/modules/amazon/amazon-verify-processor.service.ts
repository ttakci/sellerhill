import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonScrapingService } from './amazon-scraping.service';

interface VerifyAmazonAccountData {
  userId: string;
  accountId: string;
}

/**
 * Consumes `amazon-verify` jobs. Concurrency 1 — Playwright is heavy and the
 * scraping service's rate limiter already caps per-account browser actions.
 * Terminal outcome (success or final-attempt failure) always resolves the
 * account out of `verifying` so it can never get stuck in-flight.
 */
@Processor('amazon-verify', { concurrency: 1 })
export class AmazonVerifyProcessorService extends WorkerHost {
  private readonly logger = new Logger(AmazonVerifyProcessorService.name);

  constructor(
    private readonly accountsService: AmazonAccountsService,
    private readonly scrapingService: AmazonScrapingService
  ) {
    super();
  }

  async process(job: Job<VerifyAmazonAccountData>): Promise<void> {
    const { userId, accountId } = job.data;

    // Account may have been deleted between enqueue and execution.
    try {
      await this.accountsService.findOne(userId, accountId);
    } catch {
      this.logger.warn(`Account ${accountId} no longer exists; skipping verification`);
      return;
    }

    const result = await this.scrapingService.testLogin(userId, accountId);

    if (result.success) {
      await this.accountsService.markVerified(userId, accountId);
      this.logger.log(`Account ${accountId} verified successfully`);
      return;
    }

    // BullMQ will retry per `attempts`; only mark invalid on the final attempt
    // so a transient captcha/transport blip doesn't prematurely flip the status.
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      await this.accountsService.markInvalid(
        userId,
        accountId,
        result.error ?? 'Verification failed'
      );
      this.logger.warn(`Account ${accountId} marked invalid: ${result.error ?? 'unknown'}`);
    } else {
      // Let BullMQ retry by rethrowing; status stays `verifying`.
      throw new Error(result.error ?? 'Verification failed');
    }
  }
}
