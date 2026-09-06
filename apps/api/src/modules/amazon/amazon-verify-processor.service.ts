import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { extractCorrelationId, generateCorrelationId } from '@repo/shared';
import { Job } from 'bullmq';

import { withCorrelation } from '../../common/observability/correlation.context';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { classifyAmazonVerificationFailure } from './amazon-verify-helpers';

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
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'amazon-verify',
        jobId: job.id,
        origin: 'worker',
      },
      () => this.verifyAccount(job)
    );
  }

  private async verifyAccount(job: Job<VerifyAmazonAccountData>): Promise<void> {
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
    // BullMQ increments attemptsMade only after an attempt has failed. While the
    // second (final) attempt is executing, attemptsMade is therefore 1, not 2.
    // Include the current attempt or the account stays VERIFYING forever after
    // the last failure because BullMQ has no third run in which to mark INVALID.
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      // Persist only a stable code — never the raw Playwright/Amazon message,
      // which is unbounded and can echo account identifiers (see the throw
      // sites in amazon-scraping.service.ts). The raw text stays in this log.
      const failureCode = classifyAmazonVerificationFailure(result.error);
      await this.accountsService.markInvalid(userId, accountId, failureCode);
      this.logger.warn(
        `Account ${accountId} marked invalid (${failureCode}): ${result.error ?? 'unknown'}`
      );
    } else {
      // Let BullMQ retry by rethrowing; status stays `verifying`.
      throw new Error(result.error ?? 'Verification failed');
    }
  }
}
