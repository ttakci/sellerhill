import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

@Injectable()
export class AmazonTrackingQueueService implements OnModuleInit {
  private readonly logger = new Logger(AmazonTrackingQueueService.name);

  constructor(
    @InjectQueue('amazon-tracking') private readonly trackingQueue: Queue,
    private readonly databaseService: DatabaseService
  ) {}

  async onModuleInit() {
    await this.reconcileSchedulers();
  }

  private async reconcileSchedulers() {
    this.logger.log('Reconciling Amazon order tracking schedulers...');

    // Find all orders that need Amazon tracking
    const trackedOrders = await this.databaseService.query<{
      id: string;
      amazon_account_id: string;
      status: string;
    }>(
      `SELECT id, amazon_account_id, status
       FROM orders
       WHERE amazon_account_id IS NOT NULL
         AND amazon_order_id IS NOT NULL
         AND status NOT IN ('completed', 'cancelled', 'delivered')`
    );

    this.logger.log(`Found ${trackedOrders.length} orders needing Amazon tracking`);

    // Remove orphaned schedulers first
    const schedulers = await this.trackingQueue.getJobSchedulers(0, -1, true);
    const activeOrderIds = new Set(trackedOrders.map((o) => o.id));

    for (const scheduler of schedulers) {
      if (!scheduler.id) {continue;}
      const orderId = scheduler.id.replace('track-amazon-', '');
      if (!activeOrderIds.has(orderId)) {
        await this.trackingQueue.removeJobScheduler(scheduler.id);
        this.logger.debug(`Removed orphaned scheduler: ${scheduler.id}`);
      }
    }

    // Create/update schedulers for tracked orders
    for (const order of trackedOrders) {
      await this.scheduleOrderTracking(order.id, order.amazon_account_id, order.status);
    }
  }

  async scheduleOrderTracking(orderId: string, amazonAccountId: string, orderStatus?: string) {
    const schedulerId = `track-amazon-${orderId}`;

    // Adjust interval based on order status
    let interval: number;
    if (orderStatus === 'shipped') {
      interval = 12 * 60 * 60 * 1000; // Every 12 hours for shipped orders (waiting for delivery)
    } else {
      interval = 6 * 60 * 60 * 1000; // Every 6 hours for pending/processing
    }

    await this.trackingQueue.upsertJobScheduler(
      schedulerId,
      { every: interval },
      {
        name: 'track-amazon-order',
        data: stampCurrentCorrelation({ orderId, amazonAccountId }),
        opts: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60000 },
        },
      }
    );

    this.logger.debug(`Scheduled tracking for order ${orderId} (every ${interval / 3600000}h)`);
  }

  async removeOrderTracking(orderId: string) {
    const schedulerId = `track-amazon-${orderId}`;
    const removed = await this.trackingQueue.removeJobScheduler(schedulerId);
    if (removed) {
      this.logger.debug(`Removed tracking scheduler for order ${orderId}`);
    }
  }

  async triggerImmediateTracking(orderId: string, amazonAccountId: string) {
    await this.trackingQueue.add(
      'track-amazon-order',
      stampCurrentCorrelation({ orderId, amazonAccountId }),
      {
        priority: 1,
        jobId: `track-immediate-${orderId}-${Date.now()}`,
        removeOnComplete: { age: 300 },
        removeOnFail: { age: 3600 },
      }
    );
  }
}
