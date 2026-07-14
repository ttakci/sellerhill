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
   */
  async enqueue(userId: string, accountId: string): Promise<void> {
    await this.verifyQueue.add(
      'verify-amazon-account',
      { userId, accountId },
      {
        jobId: `verify-${accountId}`,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
      }
    );
    this.logger.debug(`Enqueued verification for account ${accountId}`);
  }
}
