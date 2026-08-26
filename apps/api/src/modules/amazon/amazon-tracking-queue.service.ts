import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

/** Env int with fallback + inclusive clamp (typo'd env must not break cadence). */
function clampIntEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

@Injectable()
export class AmazonTrackingQueueService implements OnModuleInit {
  private readonly logger = new Logger(AmazonTrackingQueueService.name);
  /**
   * Poll cadence, env-tunable (hours). Pre-ship default 6h: the only urgency
   * is pushing the tracking number to eBay reasonably fast after Amazon
   * ships. Shipped default 24h: delivered-detection has NO time-critical
   * side effect (it only flips the local status to completed), and the
   * shipping phase is the longest part of an order's life — polling it at
   * 12h doubled scrape traffic for zero functional gain.
   */
  private readonly preShipIntervalMs =
    clampIntEnv(process.env.AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS, 6, 1, 72) * 60 * 60 * 1000;
  private readonly shippedIntervalMs =
    clampIntEnv(process.env.AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS, 24, 1, 168) * 60 * 60 * 1000;

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

  async scheduleOrderTracking(
    orderId: string,
    amazonAccountId: string,
    orderStatus?: string,
    intervalHoursOverride?: number
  ) {
    const schedulerId = `track-amazon-${orderId}`;

    // Adjust interval based on order status (env-tunable, see field docs).
    // An explicit override (the eBay-push deferral retry, see
    // `tracking-deferral.ts`) always wins — it re-arms the scheduler tighter
    // than the status-derived interval for the duration of the deferral
    // window, without touching either env-tunable default.
    const interval =
      intervalHoursOverride !== undefined
        ? intervalHoursOverride * 60 * 60 * 1000
        : orderStatus === 'shipped'
          ? this.shippedIntervalMs
          : this.preShipIntervalMs;

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
