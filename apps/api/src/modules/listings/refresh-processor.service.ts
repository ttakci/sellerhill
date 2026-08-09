import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  extractCorrelationId,
  generateCorrelationId,
  KeepaStockStatus,
  KeepaUsageSource,
  ListingStatus,
  PlatformSettingKey,
  type KeepaProduct,
} from '@repo/shared';
import { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { withCorrelation } from '../../common/observability/correlation.context';
import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { ProductSyncService, type PendingListingUpdate } from './product-sync.service';
import { dataFailureDelayMinutes } from './refresh-backoff';

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
  specs: Record<string, string> | null;
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
const REFRESH_CONCURRENCY = Math.max(1, Math.floor(Number(process.env.KEEPA_REFRESH_WORKER_CONCURRENCY) || 1));

@Processor('keepa-refresh', { concurrency: REFRESH_CONCURRENCY })
export class RefreshProcessorService extends WorkerHost {
  private readonly logger = new Logger(RefreshProcessorService.name);

  constructor(
    @InjectQueue('keepa-refresh') private readonly refreshQueue: Queue,
    private readonly platformSettings: PlatformSettingsService,
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
   * Scheduler tick: atomically CLAIM the most overdue products and enqueue a
   * refresh batch. The claim advances next_refresh_at by a short lease inside
   * the same statement (FOR UPDATE SKIP LOCKED), so overlapping ticks or
   * parallel workers can never select the same rows and double-spend tokens.
   * If the batch permanently fails, the lease expires and the rows become due
   * again — no row is ever lost.
   *
   * Scope: only products with ≥1 ACTIVE listing are refreshed. Products whose
   * listings are all draft/ended have no eBay surface to update; drafts get a
   * fresh fetch on the publish path instead. This applies to every product
   * equally — there is no per-product sales-velocity tiering.
   */
  private async selectRefreshBatch(): Promise<void> {
    // Runtime kill switch. The repeatable tick is registered at boot, so the
    // admin panel's "Keepa refresh enabled" toggle is enforced HERE — turning
    // it off stops all background token spend immediately, without a restart.
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.KEEPA_REFRESH_ENABLED))) {
      this.logger.debug('Keepa refresh disabled by platform settings — skipping tick.');
      return;
    }
    const batchSize = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_BATCH_SIZE);
    const leaseMinutes = await this.platformSettings.getNumber(
      PlatformSettingKey.KEEPA_REFRESH_CLAIM_LEASE_MINUTES,
    );

    const rows = await this.databaseService.query<{ id: string }>(
      `WITH due AS (
         SELECT p.id
         FROM products p
         WHERE (p.next_refresh_at IS NULL OR p.next_refresh_at <= NOW())
           AND EXISTS (
             SELECT 1 FROM listings l
             WHERE l.product_id = p.id AND l.status = '${ListingStatus.ACTIVE}'
           )
         ORDER BY p.next_refresh_at ASC NULLS FIRST
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE products
       SET next_refresh_at = NOW() + make_interval(mins => $2::int),
           last_refresh_attempt_at = NOW()
       FROM due
       WHERE products.id = due.id
       RETURNING products.id`,
      [batchSize, leaseMinutes]
    );

    if (rows.length === 0) {
      this.logger.debug('No products due for refresh.');
      return;
    }

    const productIds = rows.map((r) => r.id);
    this.logger.log(`Claimed ${productIds.length} products for refresh (lease ${leaseMinutes}m).`);

    await this.refreshQueue.add(
      'refresh-batch',
      stampCurrentCorrelation({ productIds }),
      {
        jobId: `refresh-batch-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      }
    );
  }

  /**
   * Worker: one bulk Keepa call for the whole batch (chunked internally at
   * Keepa's 100-ASIN limit), then per-product compare, update, and fan-out.
   * Per-product failures are isolated inside the batch; a transport failure
   * (Keepa HTTP error) propagates so BullMQ retries the batch. Rows stay
   * claimed during retries; if all attempts fail the claim lease expires and
   * the products become due again.
   */
  private async refreshBatch(job: Job<RefreshBatchJobData>): Promise<void> {
    const { productIds } = job.data;
    if (productIds.length === 0) {
      return;
    }

    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const products = await this.databaseService.query<ProductRow>(
      `SELECT id, asin, price, stock, title, image_urls, brand, features, description, specs, consecutive_failures
       FROM products
       WHERE id IN (${placeholders})`,
      productIds
    );

    if (products.length === 0) {
      return;
    }

    const asins = products.map((p) => p.asin);

    // Transport failure here (429/5xx/network) → throws → BullMQ retries the
    // whole batch idempotently (rows are still claimed by the lease).
    const { products: keepaProducts, meta } = await this.keepaService.getProducts(asins);
    await this.keepaUsageService.captureBalance(meta);

    // Fair-split across REQUESTED ASINs (not returned products): a missing
    // ASIN still consumed its share of the request, and its users must not be
    // subsidized by the users of returned ASINs.
    const tokenShare = meta.tokensConsumed / products.length;
    const userIdsByProduct = await this.loadUserIdsByProduct(productIds);
    const keepaByAsin = new Map(keepaProducts.map((p) => [p.asin, p]));
    const pendingUpdates: PendingListingUpdate[] = [];

    for (const row of products) {
      // Token was spent for every requested ASIN whether or not data came back.
      await this.keepaUsageService.logUsage({
        asin: row.asin,
        tokens: tokenShare,
        source: KeepaUsageSource.REFRESH,
        userIds: userIdsByProduct.get(row.id) ?? [],
      });

      const kp = keepaByAsin.get(row.asin);
      if (!kp) {
        // Keepa returned no data for this ASIN → data failure (not transport):
        // escalating backoff, then quarantine past the threshold.
        await this.handleDataFailure(row);
        continue;
      }

      try {
        pendingUpdates.push(...(await this.applyKeepaProduct(row, kp)));
      } catch (error: unknown) {
        this.logger.error(
          `Refresh failed for ASIN ${row.asin}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // One flush for the WHOLE batch, not one per product. Two products sold by
    // the same seller now share a bulk call; previously they never could, and
    // each listing cost four eBay calls of its own.
    await this.productSyncService.flushUpdates(pendingUpdates);
  }

  /**
   * Compare + update one product from its Keepa snapshot, fan out if its
   * commerce state (price/stock) changed.
   *
   * Unknown-preserve contract: a null price or UNKNOWN stock never overwrites
   * the previous value — Keepa failing to observe the Buy Box is not evidence
   * the product is free or out of stock.
   *
   * Returns the listing updates this product implies rather than pushing them,
   * so the caller can batch every product's updates into shared bulk calls.
   */
  private async applyKeepaProduct(row: ProductRow, kp: KeepaProduct): Promise<PendingListingUpdate[]> {
    const intervalMinutes = await this.platformSettings.getNumber(
      PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES,
    );

    // Resolve effective values: fall back to the previous row value when the
    // new observation is missing.
    const previousPrice = row.price?.current !== undefined ? Number(row.price.current) : null;
    const effectivePrice = kp.price ?? previousPrice;
    const effectiveStock = kp.stockStatus === KeepaStockStatus.UNKNOWN ? row.stock : kp.stock;

    const commerceChanged =
      (effectivePrice !== null && effectivePrice !== previousPrice) ||
      (effectiveStock !== null && Number(row.stock ?? 0) !== Number(effectiveStock));
    const metadataChanged =
      (kp.title !== undefined && kp.title !== row.title) ||
      (kp.brand !== undefined && kp.brand !== row.brand) ||
      (kp.description !== undefined && kp.description !== (row.description ?? '')) ||
      // Backfill: rows cached before item specifics were extracted have an empty
      // `specs` map. Without this they would keep publishing bare listings until
      // their price happened to move.
      (Object.keys(kp.specs ?? {}).length > 0 && Object.keys(row.specs ?? {}).length === 0);

    if (commerceChanged || metadataChanged) {
      await this.databaseService.query(
        `UPDATE products
         SET price = CASE WHEN $1::numeric IS NOT NULL
                          THEN jsonb_set(COALESCE(price, '{}'::jsonb), '{current}', to_jsonb($1::numeric))
                          ELSE price END,
             stock = COALESCE($2, stock),
             title = $3,
             image_urls = $4,
             brand = $5,
             features = $6,
             description = $7,
             -- Attribute maps only grow richer: a refresh that resolved nothing
             -- must not wipe item specifics captured on an earlier fetch.
             specs = CASE WHEN $11::jsonb = '{}'::jsonb THEN specs ELSE $11::jsonb END,
             identifiers = CASE WHEN $12::jsonb = '{}'::jsonb THEN identifiers ELSE $12::jsonb END,
             raw_keepa_data = $8,
             last_refresh_attempt_at = NOW(),
             last_successful_refresh_at = NOW(),
             next_refresh_at = NOW() + make_interval(mins => $9::int),
             consecutive_failures = 0,
             updated_at = NOW()
         WHERE id = $10`,
        [
          kp.price,
          effectiveStock,
          kp.title ?? row.title,
          JSON.stringify(kp.imageUrls?.length ? kp.imageUrls : (row.image_urls ?? [])),
          kp.brand ?? row.brand,
          JSON.stringify(kp.features ?? row.features ?? []),
          kp.description ?? row.description ?? '',
          JSON.stringify(kp.raw ?? {}),
          intervalMinutes,
          row.id,
          JSON.stringify(kp.specs ?? {}),
          JSON.stringify(kp.identifiers ?? {}),
        ]
      );

      this.logger.debug(
        `Refreshed ASIN ${row.asin} → price=${effectivePrice}, stock=${effectiveStock} (${kp.stockStatus})` +
          `${commerceChanged ? ' [commerce]' : ''}${metadataChanged ? ' [metadata]' : ''}`
      );

      if (commerceChanged) {
        // Fan out: recompute every active listing sharing this ASIN. The push
        // itself is deferred to the batch flush so listings from different
        // products can share one eBay call.
        return this.productSyncService.computePendingUpdates(row.id, row.asin);
      }
      return [];
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

    return [];
  }

  /**
   * Data-failure handling with escalating backoff before quarantine, so a bad
   * ASIN cannot burn tokens on every scheduler tick: 5m → 15m → 60m → 240m,
   * then quarantine at the failure threshold.
   */
  private async handleDataFailure(row: ProductRow): Promise<void> {
    const maxFailures = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_MAX_FAILURES);
    const quarantineMinutes = await this.platformSettings.getNumber(
      PlatformSettingKey.KEEPA_REFRESH_QUARANTINE_MINUTES,
    );
    const newCount = row.consecutive_failures + 1;

    const delayMinutes = dataFailureDelayMinutes(newCount, maxFailures, quarantineMinutes);

    await this.databaseService.query(
      `UPDATE products
       SET consecutive_failures = $1,
           last_refresh_attempt_at = NOW(),
           next_refresh_at = NOW() + make_interval(mins => $2::int)
       WHERE id = $3`,
      [newCount, delayMinutes, row.id]
    );

    if (newCount >= maxFailures) {
      this.logger.warn(`ASIN ${row.asin} quarantined for ${formatMinutes(quarantineMinutes)} after ${newCount} failures`);
    } else {
      this.logger.debug(
        `ASIN ${row.asin} data failure (${newCount}/${maxFailures}); retry in ${formatMinutes(delayMinutes)}`
      );
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

function formatMinutes(minutes: number): string {
  if (minutes >= 1440) {
    return `${Math.round(minutes / 1440)} day(s)`;
  }
  if (minutes >= 60) {
    return `${Math.round(minutes / 60)} hour(s)`;
  }
  return `${minutes} minute(s)`;
}
