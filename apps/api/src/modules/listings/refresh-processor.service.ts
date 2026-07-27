import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractCorrelationId, generateCorrelationId, KeepaUsageSource, ListingStatus, type KeepaProduct } from '@repo/shared';
import { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';

import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { ProductSyncService } from './product-sync.service';

interface ProductRow {
  id: string;
  asin: string;
  price: { current?: number; currency?: string } | null;
  stock: number | null;
  title: string | null;
  image_urls: string[] | null;
  brand: string | null;
  features: string[] | null;
  description: string | null;
  consecutive_failures: number;
}

interface SelectBatchJobData {
  manual?: boolean;
}

interface RefreshBatchJobData {
  productIds: string[];
}

// Worker concurrency is applied at decoration time, so read it from the env
// directly (ConfigService is not available in decorator metadata).
const REFRESH_CONCURRENCY = Math.max(1, Number(process.env.KEEPA_REFRESH_WORKER_CONCURRENCY) || 1);

@Processor('keepa-refresh', { concurrency: REFRESH_CONCURRENCY })
export class RefreshProcessorService extends WorkerHost {
  private readonly logger = new Logger(RefreshProcessorService.name);

  constructor(
    @InjectQueue('keepa-refresh') private readonly refreshQueue: Queue,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly keepaService: KeepaService,
    private readonly keepaUsageService: KeepaUsageService,
    private readonly productSyncService: ProductSyncService
  ) {
    super();
  }

  async process(job: Job<SelectBatchJobData | RefreshBatchJobData>): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'keepa-refresh',
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        if (job.name === 'select-refresh-batch') {
          await this.selectRefreshBatch();
        } else if (job.name === 'refresh-batch') {
          await this.refreshBatch(job as Job<RefreshBatchJobData>);
        } else {
          this.logger.warn(`Unknown keepa-refresh job name: ${job.name}`);
        }
      }
    );
  }

  /**
   * Scheduler tick: select the most overdue products and enqueue a single
   * refresh-batch job (one bulk Keepa call). Knows nothing about Keepa itself.
   */
  private async selectRefreshBatch(): Promise<void> {
    const batchSize = this.configService.get<number>('KEEPA_REFRESH_BATCH_SIZE') ?? 50;

    const rows = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM products
       WHERE next_refresh_at IS NULL OR next_refresh_at <= NOW()
       ORDER BY next_refresh_at ASC NULLS LAST
       LIMIT $1`,
      [batchSize]
    );

    if (rows.length === 0) {
      this.logger.debug('No products due for refresh.');
      return;
    }

    const productIds = rows.map((r) => r.id);
    this.logger.log(`Selected ${productIds.length} products for refresh.`);

    await this.refreshQueue.add(
      'refresh-batch',
      stampCurrentCorrelation({ productIds }),
      {
        // Unique per tick so overlapping scheduler runs don't duplicate; BullMQ
        // exponential backoff handles transport failures (whole batch retries).
        jobId: `refresh-batch-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      }
    );
  }

  /**
   * Worker: one bulk Keepa call for the whole batch, then per-product compare,
   * update, and fan-out. Per-product failures are isolated inside the batch;
   * a transport failure (Keepa HTTP error) propagates so BullMQ retries the batch.
   */
  private async refreshBatch(job: Job<RefreshBatchJobData>): Promise<void> {
    const { productIds } = job.data;
    if (productIds.length === 0) {
      return;
    }

    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const products = await this.databaseService.query<ProductRow>(
      `SELECT id, asin, price, stock, title, image_urls, brand, features, description, consecutive_failures
       FROM products
       WHERE id IN (${placeholders})`,
      productIds
    );

    if (products.length === 0) {
      return;
    }

    const asins = products.map((p) => p.asin);

    // Transport failure here (429/5xx/network) → throws → BullMQ retries the
    // whole batch. next_refresh_at is NOT advanced, so products stay due.
    const { products: keepaProducts, meta } = await this.keepaService.getProducts(asins);
    await this.keepaUsageService.captureBalance(meta);

    const tokenShare = meta.tokensConsumed / Math.max(keepaProducts.length, 1);
    const userIdsByProduct = await this.loadUserIdsByProduct(productIds);
    const returnedAsins = new Set(keepaProducts.map((p) => p.asin));

    for (const kp of keepaProducts) {
      const row = products.find((p) => p.asin === kp.asin);
      if (!row) {
        continue;
      }
      try {
        await this.applyKeepaProduct(row, kp, tokenShare, userIdsByProduct.get(row.id) ?? []);
      } catch (error: unknown) {
        this.logger.error(
          `Refresh failed for ASIN ${row.asin}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // ASINs Keepa returned no data for → treat as a data failure (not a transport
    // failure): bump consecutive_failures, quarantine once past the threshold so
    // a permanently-dead ASIN can't starve the refresh queue.
    for (const row of products) {
      if (!returnedAsins.has(row.asin)) {
        await this.handleDataFailure(row);
      }
    }
  }

  /** Compare + update one product from its Keepa snapshot, fan out if changed. */
  private async applyKeepaProduct(
    row: ProductRow,
    kp: KeepaProduct,
    tokenShare: number,
    userIds: string[]
  ): Promise<void> {
    const intervalMinutes = this.configService.get<number>('KEEPA_REFRESH_INTERVAL_MINUTES') ?? 720;

    // Token was spent whether or not the data changed — attribute it now.
    await this.keepaUsageService.logUsage({
      asin: row.asin,
      tokens: tokenShare,
      source: KeepaUsageSource.REFRESH,
      userIds,
    });

    const changed = this.hasProductChanged(row, kp);

    if (changed) {
      await this.databaseService.query(
        `UPDATE products
         SET price = jsonb_set(COALESCE(price, '{}'::jsonb), '{current}', to_jsonb($1::numeric)),
             stock = $2,
             title = $3,
             image_urls = $4,
             brand = $5,
             features = $6,
             description = $7,
             raw_keepa_data = $8,
             last_refresh_attempt_at = NOW(),
             last_successful_refresh_at = NOW(),
             next_refresh_at = NOW() + make_interval(mins => $9::int),
             consecutive_failures = 0,
             updated_at = NOW()
         WHERE id = $10`,
        [
          kp.price,
          kp.stock,
          kp.title ?? row.title,
          JSON.stringify(kp.imageUrls ?? []),
          kp.brand ?? row.brand,
          JSON.stringify(kp.features ?? []),
          kp.description ?? row.description ?? '',
          JSON.stringify(kp.raw ?? {}),
          intervalMinutes,
          row.id,
        ]
      );

      // Fan out: recompute every active listing sharing this ASIN and push to
      // eBay only where price/quantity actually changed.
      await this.productSyncService.updateAllListingsForProduct(row.id, row.asin);
      this.logger.debug(`Refreshed (changed) ASIN ${row.asin} → price=${kp.price}, stock=${kp.stock}`);
    } else {
      await this.databaseService.query(
        `UPDATE products
         SET last_refresh_attempt_at = NOW(),
             last_successful_refresh_at = NOW(),
             next_refresh_at = NOW() + make_interval(mins => $1::int),
             consecutive_failures = 0
         WHERE id = $2`,
        [intervalMinutes, row.id]
      );
      this.logger.debug(`Refreshed (unchanged) ASIN ${row.asin}`);
    }
  }

  /** A product changed if its buy-box price, stock, or title differs. */
  private hasProductChanged(row: ProductRow, kp: KeepaProduct): boolean {
    const currentPrice = row.price?.current;
    if (currentPrice === undefined || Number(currentPrice) !== Number(kp.price)) {
      return true;
    }
    if (Number(row.stock ?? 0) !== Number(kp.stock)) {
      return true;
    }
    if (kp.title && row.title !== kp.title) {
      return true;
    }
    return false;
  }

  /**
   * Per-product failure handling without forwarding next_refresh_at beyond a
   * quarantine threshold — prevents poison products from starving the queue.
   */
  private async handleDataFailure(row: ProductRow): Promise<void> {
    const maxFailures = this.configService.get<number>('KEEPA_REFRESH_MAX_FAILURES') ?? 5;
    const quarantineMinutes = this.configService.get<number>('KEEPA_REFRESH_QUARANTINE_MINUTES') ?? 1440;
    const newCount = row.consecutive_failures + 1;

    if (newCount >= maxFailures) {
      await this.databaseService.query(
        `UPDATE products
         SET consecutive_failures = $1,
             last_refresh_attempt_at = NOW(),
             next_refresh_at = NOW() + make_interval(mins => $2::int)
         WHERE id = $3`,
        [newCount, quarantineMinutes, row.id]
      );
      this.logger.warn(`ASIN ${row.asin} quarantined for ${quotaMinutes(quarantineMinutes)} after ${newCount} failures`);
    } else {
      // Leave next_refresh_at untouched so the product is retried on a near-future tick.
      await this.databaseService.query(
        `UPDATE products
         SET consecutive_failures = $1,
             last_refresh_attempt_at = NOW()
         WHERE id = $2`,
        [newCount, row.id]
      );
      this.logger.debug(`ASIN ${row.asin} data failure (${newCount}/${maxFailures}); will retry`);
    }
  }

  /** Batched user-lookup for fair-split token attribution. */
  private async loadUserIdsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (productIds.length === 0) {
      return map;
    }
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await this.databaseService.query<{ product_id: string; user_id: string }>(
      `SELECT DISTINCT product_id, user_id
       FROM listings
       WHERE product_id IN (${placeholders}) AND status = '${ListingStatus.ACTIVE}'`,
      productIds
    );
    for (const r of rows) {
      const arr = map.get(r.product_id) ?? [];
      arr.push(r.user_id);
      map.set(r.product_id, arr);
    }
    return map;
  }
}

function quotaMinutes(minutes: number): string {
  if (minutes >= 1440) {
    return `${Math.round(minutes / 1440)} day(s)`;
  }
  if (minutes >= 60) {
    return `${Math.round(minutes / 60)} hour(s)`;
  }
  return `${minutes} minute(s)`;
}
