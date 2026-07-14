import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

interface VerifyAmazonAccountData {
  userId: string;
  accountId: string;
}

@Injectable()
export class AmazonVerifyQueueService {
  private readonly logger = new Logger(AmazonVerifyQueueService.name);

  constructor(
    @InjectQueue('amazon-verify') private readonly verifyQueue: Queue<VerifyAmazonAccountData>
  ) {}

  /**
   * Enqueue a credential verification. jobId is bucketed per account so a rapid
   * second save coalesces with any in-flight job rather than stacking logins.
   * Jobs are removed immediately on completion AND failure so the per-account
   * jobId is freed the moment a verify finishes — otherwise a lingering
   * completed/failed job would silently dedupe the next enqueue (BullMQ keeps
   * jobId unique across all non-removed states) and leave the account stuck in
   * `verifying` with no worker running.
   */
  async enqueue(userId: string, accountId: string): Promise<void> {
    await this.verifyQueue.add(
      'verify-amazon-account',
      { userId, accountId },
      {
        jobId: `verify-${accountId}`,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
      }
    );
    this.logger.debug(`Enqueued verification for account ${accountId}`);
  }
}
