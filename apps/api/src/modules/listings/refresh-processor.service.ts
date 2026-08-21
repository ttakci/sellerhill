import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  AmazonMarketplace,
  ENTITLED_SUBSCRIPTION_STATUSES,
  extractCorrelationId,
  generateCorrelationId,
  KeepaStockStatus,
  KeepaUsageSource,
  ListingStatus,
  PlatformSettingKey,
  type KeepaApiMeta,
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
import { resolveRefreshBatchSize } from './refresh-batch-size';

interface ProductRow {
  id: string;
  asin: string;
  // Storefront this product was sourced from (migration 082). Grouped on
  // below so one batch can span marketplaces without mixing Keepa domains
  // into a single request.
  marketplace: string;
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
    const batchSize = await this.resolveBatchSize();
    const leaseMinutes = await this.platformSettings.getNumber(
      PlatformSettingKey.KEEPA_REFRESH_CLAIM_LEASE_MINUTES,
    );

    // Entitlement filter — the cost stop.
    //
    // This query had no billing awareness at all, so an account that stopped
    // paying kept every one of its products on the refresh schedule and kept
    // burning Keepa tokens indefinitely. Keepa is the platform's largest
    // recurring cost (~$0.011 per active product per month), so a lapsed
    // 5,000-listing account was ~$55/month of pure loss with nothing to stop it.
    //
    // `products` is a SHARED, ASIN-keyed cache, so the rule is deliberately
    // "at least one ACTIVE listing belongs to an entitled owner" rather than
    // "every owner is entitled": a non-payer's listing goes stale, while a
    // paying seller listing the same ASIN is unaffected.
    //
    // Built as a conditional fragment rather than a permanent join so that with
    // enforcement off the statement is byte-identical to the original.
    const enforcementOn = await this.platformSettings.getBoolean(
      PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED,
    );
    const entitledStatuses = ENTITLED_SUBSCRIPTION_STATUSES.map((v) => `'${v}'`).join(', ');
    const entitlementJoin = enforcementOn
      ? `JOIN billing_customers bc ON bc.user_id = l.user_id
              JOIN billing_subscriptions bs ON bs.customer_id = bc.id
                AND bs.status IN (${entitledStatuses})`
      : '';

    const rows = await this.databaseService.query<{ id: string }>(
      `WITH due AS (
         SELECT p.id
         FROM products p
         WHERE (p.next_refresh_at IS NULL OR p.next_refresh_at <= NOW())
           AND EXISTS (
             SELECT 1 FROM listings l
             ${entitlementJoin}
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
   * How many products this tick may claim. By default this is derived from the
   * Keepa plan's own refill rate (`keepa_balance.refill_rate`) rather than a
   * fixed number, because the batch size IS the per-minute refresh throughput
   * and must track the plan: too high burns the retry budget on Keepa 429s,
   * too low lets the refresh interval stretch silently. Upgrading the Keepa
   * plan therefore raises throughput on its own, with no second setting to
   * remember. Operators can still pin a value by turning the auto flag off.
   *
   * The policy itself is the pure `resolveRefreshBatchSize` (unit-tested);
   * this method only gathers the inputs.
   */
  private async resolveBatchSize(): Promise<number> {
    const [manualBatchSize, autoEnabled, reservePercent, refillRate] = await Promise.all([
      this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_BATCH_SIZE),
      this.platformSettings.getBoolean(PlatformSettingKey.KEEPA_REFRESH_BATCH_AUTO),
      this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_RESERVE_PERCENT),
      this.keepaUsageService.getLatestRefillRate(),
    ]);

    const resolved = resolveRefreshBatchSize({
      refillRate,
      reservePercent,
      manualBatchSize,
      autoEnabled,
      min: 1,
      max: 1000,
    });

    if (resolved.source === 'auto') {
      this.logger.debug(
        `Batch size ${resolved.batchSize} derived from Keepa refill rate ${refillRate} tpm (reserve ${reservePercent}%).`
      );
    }
    return resolved.batchSize;
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
      `SELECT id, asin, marketplace, price, stock, title, image_urls, brand, features, description, specs, consecutive_failures
       FROM products
       WHERE id IN (${placeholders})`,
      productIds
    );

    if (products.length === 0) {
      return;
    }

    // Keepa's `domain` param is one value per request, so a batch spanning
    // multiple Amazon marketplaces must issue one call per marketplace group
    // rather than mixing ASINs from different storefronts into one request.
    // At a single marketplace (today) this produces exactly one group and is
    // behavior-identical to the old single-call path.
    const byMarketplace = new Map<AmazonMarketplace, ProductRow[]>();
    for (const row of products) {
      const marketplace = row.marketplace as AmazonMarketplace;
      const group = byMarketplace.get(marketplace);
      if (group) {
        group.push(row);
      } else {
        byMarketplace.set(marketplace, [row]);
      }
    }

    const keepaByAsin = new Map<string, KeepaProduct>();
    let tokensConsumed = 0;
    let lastMeta: KeepaApiMeta = { tokensConsumed: 0 };
    for (const [marketplace, group] of byMarketplace) {
      // Transport failure here (429/5xx/network) → throws → BullMQ retries the
      // whole batch idempotently (rows are still claimed by the lease).
      const { products: keepaProducts, meta } = await this.keepaService.getProducts(
        group.map((p) => p.asin),
        marketplace
      );
      lastMeta = meta;
      tokensConsumed += meta.tokensConsumed;
      for (const kp of keepaProducts) {
        keepaByAsin.set(kp.asin, kp);
      }
    }
    await this.keepaUsageService.captureBalance(lastMeta);

    // Fair-split across REQUESTED ASINs (not returned products): a missing
    // ASIN still consumed its share of the request, and its users must not be
    // subsidized by the users of returned ASINs.
    const tokenShare = tokensConsumed / products.length;
    const userIdsByProduct = await this.loadUserIdsByProduct(productIds);
    const pendingUpdates: PendingListingUpdate[] = [];

    // Token was spent for every requested ASIN whether or not data came back.
    // One bulk write for the whole batch instead of one round trip per ASIN.
    await this.keepaUsageService.logUsageBatch(
      products.map((row) => ({
        asin: row.asin,
        tokens: tokenShare,
        source: KeepaUsageSource.REFRESH,
        userIds: userIdsByProduct.get(row.id) ?? [],
      }))
    );

    for (const row of products) {
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
        return this.productSyncService.computePendingUpdates(
          row.id,
          row.asin,
          row.marketplace as AmazonMarketplace
        );
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
