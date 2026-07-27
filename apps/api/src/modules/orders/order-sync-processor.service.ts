import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EbayAccountStatus, extractCorrelationId, generateCorrelationId } from '@repo/shared';
import { Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';

import { OrderSyncService, type EbayAccountForSync } from './order-sync.service';

interface SyncUserOrdersData {
  userId: string;
}

@Processor('order-sync', { concurrency: 3 })
export class OrderSyncProcessorService extends WorkerHost {
  private readonly logger = new Logger(OrderSyncProcessorService.name);

  constructor(
    private readonly orderSyncService: OrderSyncService,
    private readonly databaseService: DatabaseService
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'order-sync',
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        this.logger.log(`Processing order sync job: ${job.name} (id: ${job.id})`);
        try {
          if (job.name === 'sync-all-orders') {
            await this.syncAllUsers();
          } else if (job.name === 'sync-user-orders') {
            const { userId } = job.data as SyncUserOrdersData;
            await this.syncSingleUser(userId);
          } else {
            this.logger.warn(`Unknown job name: ${job.name}`);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Order sync job ${job.name} failed: ${message}`);
          throw error;
        }
      }
    );
  }

  /**
   * Sync orders for all users with active eBay accounts
   */
  private async syncAllUsers(): Promise<void> {
    const accounts = await this.databaseService.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM ebay_accounts WHERE status = $1`,
      [EbayAccountStatus.ACTIVE]
    );

    this.logger.log(`Found ${accounts.length} users with active eBay accounts`);

    for (const { user_id } of accounts) {
      await this.syncSingleUser(user_id);
    }
  }

  /**
   * Sync orders for a single user
   */
  private async syncSingleUser(userId: string): Promise<number> {
    const accounts = await this.databaseService.query<EbayAccountForSync>(
      `SELECT id, user_id, marketplace_id, access_token, refresh_token,
              access_token_expires_at, created_at, status, last_ebay_sync_at
       FROM ebay_accounts WHERE user_id = $1 AND status = $2`,
      [userId, EbayAccountStatus.ACTIVE]
    );

    if (accounts.length === 0) {
      this.logger.debug(`No active accounts for user ${userId}`);
      return 0;
    }

    let total = 0;
    for (const account of accounts) {
      try {
        const count = await this.orderSyncService.syncOrdersForAccount(account);
        total += count;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Order sync failed for account ${account.id}: ${msg}`);
      }
    }

    this.logger.log(`Synced ${total} orders for user ${userId}`);
    return total;
  }
}
