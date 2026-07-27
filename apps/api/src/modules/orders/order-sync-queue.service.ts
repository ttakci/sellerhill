import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

@Injectable()
export class OrderSyncQueueService implements OnModuleInit {
  private readonly logger = new Logger(OrderSyncQueueService.name);

  constructor(@InjectQueue('order-sync') private readonly orderSyncQueue: Queue) {}

  async onModuleInit() {
    await this.setupRepeatableJobs();
  }

  private async setupRepeatableJobs() {
    this.logger.log('Configuring order sync repeatable jobs...');

    await this.orderSyncQueue.add(
      'sync-all-orders',
      stampCurrentCorrelation({}),
      {
        repeat: { pattern: '*/15 * * * *' },
        jobId: 'order-sync-cron',
        removeOnComplete: true,
      }
    );

    this.logger.log('Order sync repeatable job configured (every 15 min).');
  }

  /**
   * Trigger immediate sync for a specific user (manual refresh)
   */
  async triggerUserSync(userId: string): Promise<string> {
    const job = await this.orderSyncQueue.add(
      'sync-user-orders',
      stampCurrentCorrelation({ userId }),
      {
        priority: 1,
        jobId: `order-sync-user-${userId}-${Date.now()}`,
        removeOnComplete: { age: 300 },
        removeOnFail: { age: 3600 },
      }
    );

    return job.id ?? '';
  }
}
