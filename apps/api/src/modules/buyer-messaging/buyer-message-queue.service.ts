// apps/api/src/modules/buyer-messaging/buyer-message-queue.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { BuyerMessageEventType } from '@repo/shared';
import { Queue } from 'bullmq';

import { buyerMessageJobId } from './buyer-message-helpers';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS } from './buyer-messaging.constants';

export interface BuyerMessageJobData {
  ebayOrderId: string;
  userId: string;
  ebayAccountId: string;
  storeId: string | null;
  event: BuyerMessageEventType;
  feedbackDelayDays?: number;
}

@Injectable()
export class BuyerMessageQueueService {
  private readonly logger = new Logger(BuyerMessageQueueService.name);

  constructor(@InjectQueue(BUYER_MESSAGE_QUEUE) private readonly queue: Queue) {}

  /** Fail-soft: never throws to the caller (order/tracking flows must not break). */
  async enqueue(data: BuyerMessageJobData, opts: { delayMs?: number } = {}): Promise<void> {
    try {
      await this.queue.add(data.event, data, {
        jobId: buyerMessageJobId(data.ebayOrderId, data.event),
        attempts: BUYER_MESSAGING_DEFAULTS.ATTEMPTS,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
        ...(opts.delayMs ? { delay: opts.delayMs } : {}),
      });
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue buyer message ${data.event} for order ${data.ebayOrderId}: ${(err as Error).message}`,
      );
    }
  }
}
