// apps/api/src/modules/admin/admin.service.ts
//
// Read-only Admin Observability service. No mutations — all queries are
// SELECTs against the usage_events / shared_cost_entries / llm_usage_log /
// keepa_usage_log tables and BullMQ `getJobCounts()`. The service is
// intentionally cheap to call: it aggregates at the DB rather than pulling
// rows into the API process.
//
// Cost rows are stored in micro-USD (1/1,000,000 USD) as BIGINT. They are
// returned to the controller as numbers (safe for any realistic admin
// aggregate — well below Number.MAX_SAFE_INTEGER).

import { Injectable, Logger } from '@nestjs/common';
import {
  AdminWarningKind,
  AdminWarningLevel,
  ListingStatus,
  PlatformSettingKey,
  ProductDataProviderKind,
  UsageEventSource,
  UsageMetric,
  partitionProxyList,
  type AdminBillingMetricsDto,
  type AdminOperationsSummaryDto,
  type AdminOverviewDto,
  type AdminWarningDto,
  type AquilinePlanSnapshotDto,
  type ProviderCostSummaryDto,
  type ProxyVerifyResult,
  type QueueEventType,
  type QueueHealthDto,
  type QueueObservationDto,
  type QueueObservationQuery,
  type QueueOperationSummaryDto,
  type ScraperStats,
  type UsageSummaryDto,
  type UserCostSummaryDto,
} from '@repo/shared';
import type { Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { ProductSourceService } from '../listings/product-source.service';
import { buildRefreshEntitlementSql } from '../listings/refresh-entitlement-sql';
import { ScraperClient } from '../listings/scraper.client';

import { calculateFailureRate, thresholdWarning } from './admin-warnings.helpers';
import {
  buildAccessTierDistribution,
  buildAccountStatusDistribution,
  buildQuotaPressureSummary,
  resolveCostTotal,
} from './billing-metrics.helpers';
import {
  achievableSyncsPerDay,
  blockRatePercent,
  parseFailureRatePercent,
  transportFailureRatePercent,
} from './scraper-ops.helpers';

interface CountRow {
  count: string;
}

interface UsageAggregateRow {
  source: UsageEventSource;
  metric: UsageMetric;
  total_quantity: string;
  total_cost_micros: string | null;
  currency: string | null;
  tenant_count: string;
}

interface QueueObservationRow {
  id: string;
  queue_name: string;
  job_id: string;
  event: QueueEventType;
  correlation_id: string | null;
  job_name: string | null;
  attempts: string;
  duration_ms: string | null;
  error_message: string | null;
  payload_hash: string | null;
  recorded_at: Date;
}

/** Raw row shape from `aquiline_plan_snapshot` (migration `089`). */
interface AquilinePlanSnapshotRow {
  plan_code: string | null;
  window_key: string | null;
  plan_limit: number | null;
  plan_used: number | null;
  plan_remaining: number | null;
  profiles_used: number | null;
  captured_at: Date;
}

/** Names of the BullMQ queues surfaced in the admin overview. */
export const ADMIN_QUEUE_NAMES = [
  'order-sync',
  'stock-sync',
  'auto-fulfill',
  'amazon-order-sync',
  'amazon-tracking',
  'amazon-verify',
  'listings',
  'keepa-refresh',
  'buyer-message',
  'billing-trial-expiry',
  'billing-listing-plan-limit',
  'billing-subscription-reconcile',
  'billing-price-migration',
  'data-retention',
  'ebay-rate-limit-refresh',
] as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly productSource: ProductSourceService,
    private readonly scraperClient: ScraperClient
  ) {}

  /**
   * Build the top-level admin overview: counts + usage summaries + queue
   * health. Each section is independent — a failure in one does not abort the
   * others; the failed section is surfaced as an empty array / zero so the
   * admin still sees the rest.
   */
  async getOverview(
    queues: Array<{ name: string; queue: Queue }>,
    fromIso: string | null,
    toIso: string | null,
  ): Promise<AdminOverviewDto> {
    const period = this.resolvePeriod(fromIso, toIso);
    const [counts, usage, queueHealth, aquilinePlanSnapshot] = await Promise.allSettled([
      this.getCounts(),
      this.getUsageSummaries(period.from, period.to),
      this.getQueueHealth(queues),
      this.getAquilinePlanSnapshot(),
    ]);

    const c = counts.status === 'fulfilled' ? counts.value : this.emptyCounts();
    if (counts.status === 'rejected') {
      this.logger.warn(`getCounts failed: ${this.errMsg(counts.reason)}`);
    }
    const u = usage.status === 'fulfilled' ? usage.value : [];
    if (usage.status === 'rejected') {
      this.logger.warn(`getUsageSummaries failed: ${this.errMsg(usage.reason)}`);
    }
    const q = queueHealth.status === 'fulfilled' ? queueHealth.value : [];
    if (queueHealth.status === 'rejected') {
      this.logger.warn(`getQueueHealth failed: ${this.errMsg(queueHealth.reason)}`);
    }
    const aq =
      aquilinePlanSnapshot.status === 'fulfilled'
        ? aquilinePlanSnapshot.value
        : this.emptyAquilinePlanSnapshot();
    if (aquilinePlanSnapshot.status === 'rejected') {
      this.logger.warn(`getAquilinePlanSnapshot failed: ${this.errMsg(aquilinePlanSnapshot.reason)}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      totalUsers: c.totalUsers,
      activeEbayStores: c.activeEbayStores,
      activeAmazonAccounts: c.activeAmazonAccounts,
      activeListings: c.activeListings,
      ordersLast30Days: c.ordersLast30Days,
      usage: u,
      queues: q,
      aquilinePlanSnapshot: aq,
    };
  }

  /**
   * Latest Aquiline provider-plan snapshot. `profilesLimit` is a platform
   * setting, not provider data, so it is resolved independently of whether a
   * snapshot row exists — a brand-new deployment with zero conversions still
   * reports the configured ceiling, only the measured counters are null.
   */
  private async getAquilinePlanSnapshot(): Promise<AquilinePlanSnapshotDto> {
    const [rows, profilesLimit] = await Promise.all([
      this.databaseService.query<AquilinePlanSnapshotRow>(
        `SELECT plan_code, window_key, plan_limit, plan_used, plan_remaining,
                profiles_used, captured_at
           FROM aquiline_plan_snapshot
          ORDER BY captured_at DESC
          LIMIT 1`,
      ),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_MAX_PROFILES),
    ]);
    const row = rows[0];
    return {
      planCode: row?.plan_code ?? null,
      windowKey: row?.window_key ?? null,
      planLimit: row?.plan_limit ?? null,
      planUsed: row?.plan_used ?? null,
      planRemaining: row?.plan_remaining ?? null,
      profilesUsed: row?.profiles_used ?? null,
      profilesLimit,
      capturedAt: row?.captured_at ? row.captured_at.toISOString() : null,
    };
  }

  /** Fallback when `getAquilinePlanSnapshot` itself fails (DB unreachable). */
  private emptyAquilinePlanSnapshot(): AquilinePlanSnapshotDto {
    return {
      planCode: null,
      windowKey: null,
      planLimit: null,
      planUsed: null,
      planRemaining: null,
      profilesUsed: null,
      profilesLimit: null,
      capturedAt: null,
    };
  }

  /** Usage summaries grouped by (source, metric) for a period. */
  async getUsageSummaries(
    fromIso: string | null,
    toIso: string | null,
    filterSource?: UsageEventSource,
    filterMetric?: UsageMetric,
  ): Promise<UsageSummaryDto[]> {
    const period = this.resolvePeriod(fromIso, toIso);
    const where: string[] = ['recorded_at >= $1', 'recorded_at < $2'];
    const params: Array<string | number | boolean | null> = [period.from, period.to];
    let paramIdx = 3;
    if (filterSource) {
      where.push(`source = $${paramIdx}`);
      params.push(filterSource);
      paramIdx++;
    }
    if (filterMetric) {
      where.push(`metric = $${paramIdx}`);
      params.push(filterMetric);
      paramIdx++;
    }
    const rows = await this.databaseService.query<UsageAggregateRow>(
      `SELECT
         source,
         metric,
         COALESCE(SUM(quantity), 0)::TEXT AS total_quantity,
         SUM(estimated_cost_micros)::TEXT AS total_cost_micros,
         MAX(currency) AS currency,
         COUNT(DISTINCT user_id)::TEXT AS tenant_count
       FROM usage_events
       WHERE ${where.join(' AND ')}
       GROUP BY source, metric
       ORDER BY source, metric`,
      params,
    );
    return rows.map((r) => ({
      source: r.source,
      metric: r.metric,
      totalQuantity: Number.parseInt(r.total_quantity, 10) || 0,
      totalCostMicros: r.total_cost_micros === null ? null : Number.parseInt(r.total_cost_micros, 10),
      currency: r.currency,
      tenantCount: Number.parseInt(r.tenant_count, 10) || 0,
    }));
  }

  /** Snapshot of every registered BullMQ queue's job counts. */
  async getQueueHealth(queues: Array<{ name: string; queue: Queue }>): Promise<QueueHealthDto[]> {
    const results = await Promise.allSettled(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'prioritized',
        );
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          prioritized: counts.prioritized ?? 0,
        } satisfies QueueHealthDto;
      }),
    );
    const out: QueueHealthDto[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        out.push(r.value);
      } else {
        this.logger.warn(`queue ${queues[i]?.name} health failed: ${this.errMsg(r.reason)}`);
      }
    });
    return out;
  }

  async getQueueObservations(query: QueueObservationQuery): Promise<QueueObservationDto[]> {
    const period = this.resolveObservationPeriod(query.from, query.to);
    const where: string[] = ['recorded_at >= $1', 'recorded_at < $2'];
    const params: Array<string | number | boolean | null> = [period.from, period.to];
    let paramIdx = 3;
    if (query.queueName) {where.push(`queue_name = $${paramIdx++}`); params.push(query.queueName);}
    if (query.event) {where.push(`event = $${paramIdx++}`); params.push(query.event);}
    if (query.correlationId) {where.push(`correlation_id = $${paramIdx++}`); params.push(query.correlationId);}
    const limit = this.clampLimit(query.limit);
    const page = this.clampPage(query.page);
    params.push(limit, (page - 1) * limit);
    try {
      const rows = await this.databaseService.query<QueueObservationRow>(
        `SELECT id, queue_name, job_id, event, correlation_id, job_name,
                attempts::TEXT AS attempts, duration_ms::TEXT AS duration_ms,
                error_message, payload_hash, recorded_at
         FROM queue_observations WHERE ${where.join(' AND ')}
         ORDER BY recorded_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        params
      );
      return rows.map((row) => this.mapObservationRow(row));
    } catch (error: unknown) {
      this.logger.warn(`getQueueObservations failed: ${this.errMsg(error)}`);
      return [];
    }
  }

  async getQueueObservation(id: string): Promise<QueueObservationDto | null> {
    if (!id) {return null;}
    try {
      const rows = await this.databaseService.query<QueueObservationRow>(
        `SELECT id, queue_name, job_id, event, correlation_id, job_name,
                attempts::TEXT AS attempts, duration_ms::TEXT AS duration_ms,
                error_message, payload_hash, recorded_at
         FROM queue_observations WHERE id = $1`,
        [id]
      );
      return rows[0] ? this.mapObservationRow(rows[0]) : null;
    } catch (error: unknown) {
      this.logger.warn(`getQueueObservation failed: ${this.errMsg(error)}`);
      return null;
    }
  }

  async getUserCostSummaries(fromIso: string | null, toIso: string | null): Promise<UserCostSummaryDto[]> {
    const period = this.resolvePeriod(fromIso, toIso);
    const rows = await this.databaseService.query<{
      user_id: string | null;
      total_quantity: string;
      total_cost_micros: string | null;
      currency: string | null;
    }>(
      `SELECT user_id, SUM(quantity)::TEXT AS total_quantity,
              SUM(estimated_cost_micros)::TEXT AS total_cost_micros,
              MAX(currency) AS currency
       FROM usage_events WHERE recorded_at >= $1 AND recorded_at < $2
       GROUP BY user_id ORDER BY SUM(estimated_cost_micros) DESC NULLS LAST`,
      [period.from, period.to]
    );
    return rows.map((row) => ({
      userId: row.user_id,
      totalQuantity: Number(row.total_quantity),
      totalCostMicros: row.total_cost_micros === null ? null : Number(row.total_cost_micros),
      currency: row.currency,
    }));
  }

  async getProviderCostSummaries(fromIso: string | null, toIso: string | null): Promise<ProviderCostSummaryDto[]> {
    return this.getUsageSummaries(fromIso, toIso);
  }

  /**
   * Read-only billing metrics: account status distribution (proxy for
   * subscription status), access-tier distribution (proxy for plan
   * distribution), listing/AO quota usage-pressure summaries, and the total
   * estimated cost for the period. Each section is independent — a failure in
   * one does not abort the others; the failed section is surfaced as empty /
   * null so the admin still sees the rest.
   *
   * No plan/subscription tables exist today (there is no `plans` table, no
   * `subscriptions` table, and no per-user plan column). The metrics here are
   * derived from the real tables that do exist: `users.status` and
   * `users.role` for the distributions, `listings` and `amazon_accounts` for
   * the quota usage counts, and `usage_events` for the cost total. Quota
   * pressure bands use env-configurable soft thresholds (same pattern as
   * `ADMIN_QUEUE_WAITING_THRESHOLD`) — they are NOT plan limits. Unknown
   * financial data (no cost rows) is surfaced as null, never 0.
   */
  async getBillingMetrics(
    fromIso: string | null,
    toIso: string | null,
  ): Promise<AdminBillingMetricsDto> {
    const period = this.resolvePeriod(fromIso, toIso);
    const [listingWarn, listingCritical, accountWarn, accountCritical] = await Promise.all([
      this.platformSettings.getNumber(PlatformSettingKey.ADMIN_LISTING_QUOTA_WARN_THRESHOLD),
      this.platformSettings.getNumber(PlatformSettingKey.ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD),
      this.platformSettings.getNumber(PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD),
      this.platformSettings.getNumber(PlatformSettingKey.ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD),
    ]);

    const [statusRows, tierRows, listingUsages, accountUsages, costRow] = await Promise.allSettled([
      this.getAccountStatusDistribution(),
      this.getAccessTierDistribution(),
      this.getPerUserListingCounts(),
      this.getPerUserAmazonAccountCounts(),
      this.getTotalCost(period.from, period.to),
    ]);

    const accountStatusDistribution =
      statusRows.status === 'fulfilled' ? statusRows.value : [];
    if (statusRows.status === 'rejected') {
      this.logger.warn(`getAccountStatusDistribution failed: ${this.errMsg(statusRows.reason)}`);
    }
    const accessTierDistribution =
      tierRows.status === 'fulfilled' ? tierRows.value : [];
    if (tierRows.status === 'rejected') {
      this.logger.warn(`getAccessTierDistribution failed: ${this.errMsg(tierRows.reason)}`);
    }
    const listingUsagesArr =
      listingUsages.status === 'fulfilled' ? listingUsages.value : [];
    if (listingUsages.status === 'rejected') {
      this.logger.warn(`getPerUserListingCounts failed: ${this.errMsg(listingUsages.reason)}`);
    }
    const accountUsagesArr =
      accountUsages.status === 'fulfilled' ? accountUsages.value : [];
    if (accountUsages.status === 'rejected') {
      this.logger.warn(`getPerUserAmazonAccountCounts failed: ${this.errMsg(accountUsages.reason)}`);
    }
    const cost =
      costRow.status === 'fulfilled' ? costRow.value : { totalCostMicros: null, currency: null };
    if (costRow.status === 'rejected') {
      this.logger.warn(`getTotalCost failed: ${this.errMsg(costRow.reason)}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      accountStatusDistribution,
      accessTierDistribution,
      quotaPressure: [
        buildQuotaPressureSummary('listings', listingUsagesArr, listingWarn, listingCritical),
        buildQuotaPressureSummary('amazon_accounts', accountUsagesArr, accountWarn, accountCritical),
      ],
      totalEstimatedCostMicros: cost.totalCostMicros,
      currency: cost.currency,
      from: period.from,
      to: period.to,
    };
  }

  async getOperationsSummary(queues: Array<{ name: string; queue: Queue }>): Promise<AdminOperationsSummaryDto> {
    const live = await this.getQueueHealth(queues);
    const observed = await this.databaseService.query<{
      queue_name: string;
      completed: string;
      failed: string;
      average_duration_ms: string | null;
    }>(
      `SELECT queue_name,
              COUNT(*) FILTER (WHERE event = 'completed')::TEXT AS completed,
              COUNT(*) FILTER (WHERE event = 'failed')::TEXT AS failed,
              AVG(duration_ms)::TEXT AS average_duration_ms
       FROM queue_observations WHERE recorded_at >= NOW() - INTERVAL '24 hours'
       GROUP BY queue_name`
    );
    const observedByQueue = new Map(observed.map((row) => [row.queue_name, row]));
    const queueSummaries: QueueOperationSummaryDto[] = live.map((queue) => {
      const row = observedByQueue.get(queue.name);
      const completedObserved = Number(row?.completed ?? 0);
      const failedObserved = Number(row?.failed ?? 0);
      return {
        ...queue,
        completedObserved,
        failedObserved,
        failureRatePct: calculateFailureRate(failedObserved, completedObserved + failedObserved),
        averageDurationMs: row?.average_duration_ms ? Number(row.average_duration_ms) : null,
      };
    });
    const balanceRows = await this.databaseService.query<{ tokens_left: number }>(
      'SELECT tokens_left FROM keepa_balance ORDER BY captured_at DESC LIMIT 1'
    );
    const llmRows = await this.databaseService.query<{ total: string; failed: string }>(
      `SELECT COUNT(*)::TEXT AS total, COUNT(*) FILTER (WHERE success = FALSE)::TEXT AS failed
       FROM llm_usage_log WHERE requested_at >= NOW() - INTERVAL '24 hours'`
    );
    const keepaTokensLeft = balanceRows[0]?.tokens_left ?? null;
    const llmFailureRatePct = calculateFailureRate(Number(llmRows[0]?.failed ?? 0), Number(llmRows[0]?.total ?? 0));
    const warnings: AdminWarningDto[] = [];
    const queueThreshold = await this.platformSettings.getNumber(PlatformSettingKey.ADMIN_QUEUE_WAITING_THRESHOLD);
    for (const queue of queueSummaries) {
      const warning = thresholdWarning(AdminWarningKind.QUEUE_WAITING, queue.waiting, queueThreshold);
      if (warning) {warnings.push({ ...warning, subject: queue.name });}
    }

    // Which provider decides which health cards render — Keepa's token
    // balance is meaningless once the scraper is the active provider, and the
    // scraper's own health (proxies, block rate) is meaningless under Keepa.
    const productDataProvider = await this.productSource.activeProvider();
    let scraperStats: ScraperStats | null = null;
    let scraperProxies: string[] | null = null;
    if (productDataProvider === ProductDataProviderKind.KEEPA) {
      if (keepaTokensLeft !== null) {
        const threshold = await this.platformSettings.getNumber(PlatformSettingKey.ADMIN_KEEPA_LOW_TOKENS_THRESHOLD);
        if (keepaTokensLeft <= threshold) {
          warnings.push({ kind: AdminWarningKind.KEEPA_LOW_TOKENS, level: keepaTokensLeft <= threshold / 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: keepaTokensLeft, threshold });
        }
      }
    } else {
      const proxyConfig = await this.productSource.proxyConfig();
      scraperProxies = proxyConfig.proxies;
      if (scraperProxies.length === 0) {
        warnings.push({ kind: AdminWarningKind.SCRAPER_NO_PROXIES, level: AdminWarningLevel.CRITICAL, value: 0, threshold: 1 });
      }
      // Malformed entries are skipped, never sent — but silently skipping them
      // would leave the operator believing the whole list is in use. The count
      // only: the value is write-only and carries credentials.
      if (proxyConfig.dropped > 0) {
        warnings.push({ kind: AdminWarningKind.SCRAPER_PROXY_INVALID, level: AdminWarningLevel.WARNING, value: proxyConfig.dropped, threshold: 0 });
      }
      try {
        scraperStats = await this.scraperClient.getStats();
        // One knob for "the scraper is unhealthy" — the block and the parse-
        // failure rates are shown separately, but both warn at the same value.
        const warnAt = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_BLOCK_RATE_WARN_PERCENT);
        const rate = blockRatePercent(scraperStats);
        if (rate !== null && rate >= warnAt) {
          warnings.push({ kind: AdminWarningKind.SCRAPER_BLOCK_RATE_HIGH, level: rate >= warnAt * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: rate, threshold: warnAt });
        }
        const parseRate = parseFailureRatePercent(scraperStats);
        if (parseRate !== null && parseRate >= warnAt) {
          warnings.push({ kind: AdminWarningKind.SCRAPER_PARSE_FAILURE_HIGH, level: parseRate >= warnAt * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: parseRate, threshold: warnAt });
        }
        // Proxy errors and deadline expiries are in neither rate above, so a
        // dead or wrong-password proxy list would otherwise raise nothing.
        const transportRate = transportFailureRatePercent(scraperStats);
        if (transportRate !== null && transportRate >= warnAt) {
          warnings.push({ kind: AdminWarningKind.SCRAPER_TRANSPORT_FAILURE_HIGH, level: transportRate >= warnAt * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: transportRate, threshold: warnAt });
        }
        // Compose never sets SCRAPER_ALLOW_DIRECT on a server, but a PaaS env
        // panel can inject it straight into the container.
        if (scraperStats.directAllowed === true) {
          warnings.push({ kind: AdminWarningKind.SCRAPER_DIRECT_EGRESS, level: AdminWarningLevel.CRITICAL, value: 1, threshold: 0 });
        }
      } catch {
        warnings.push({ kind: AdminWarningKind.SCRAPER_UNREACHABLE, level: AdminWarningLevel.CRITICAL, value: 0, threshold: 0 });
      }
    }

    const llmThreshold = await this.platformSettings.getNumber(PlatformSettingKey.ADMIN_LLM_FAILURE_RATE_THRESHOLD);
    const llmWarning = thresholdWarning(AdminWarningKind.LLM_FAILURE_RATE, llmFailureRatePct, llmThreshold);
    if (llmWarning) {warnings.push(llmWarning);}

    // Refresh lag: how far behind schedule the oldest overdue ACTIVE-listed
    // product is, and how many distinct products the refresh pipeline is
    // actually responsible for — the real denominator for capacity planning,
    // not the whole `products` table (draft/ended listings are never
    // refreshed, and neither is a product whose only ACTIVE listings belong
    // to an unentitled owner or are over that owner's plan limit — see
    // `buildRefreshEntitlementSql`, shared with the real refresh claim in
    // `RefreshProcessorService.selectRefreshBatch` so this count can never
    // drift from what the pipeline actually does).
    //
    // `MIN(p.next_refresh_at) FILTER (WHERE p.next_refresh_at < NOW())` — the
    // FILTER binds directly to the aggregate call, never to the surrounding
    // `NOW() - ...` expression: PostgreSQL only accepts FILTER immediately
    // after a bare aggregate/window function. Attaching it to the expression
    // is a syntax error on every execution (verified live against a local
    // Postgres 16 instance running this schema).
    //
    // Wrapped in try/catch: this is one metric on a health endpoint that also
    // reports queue health and Keepa/scraper warnings, so a failure here must
    // degrade to "unknown lag", never take the whole summary down with it.
    let refreshLagMinutes: number | null = null;
    let uniqueRefreshedAsins = 0;
    try {
      const enforcementOnForRefresh = await this.platformSettings.getBoolean(PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED);
      const { entitlementJoin, planLimitFilter } = buildRefreshEntitlementSql(enforcementOnForRefresh);
      const [lagRow] = await this.databaseService.query<{ lag_minutes: string | null; unique_asins: string }>(
        `SELECT EXTRACT(EPOCH FROM (NOW() - MIN(p.next_refresh_at) FILTER (WHERE p.next_refresh_at < NOW()))) / 60 AS lag_minutes,
                COUNT(*)::text AS unique_asins
           FROM products p
          WHERE EXISTS (
            SELECT 1 FROM listings l
            ${entitlementJoin}
            WHERE l.product_id = p.id AND l.status = $1
              ${planLimitFilter}
          )`,
        [ListingStatus.ACTIVE]
      );
      refreshLagMinutes = lagRow?.lag_minutes !== null && lagRow?.lag_minutes !== undefined ? Math.round(Number(lagRow.lag_minutes)) : null;
      uniqueRefreshedAsins = Number(lagRow?.unique_asins ?? 0);
    } catch (error) {
      this.logger.warn(`Refresh-lag query failed — reporting unknown lag: ${error instanceof Error ? error.message : String(error)}`);
    }
    const intervalMinutes = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES);
    if (refreshLagMinutes !== null && refreshLagMinutes > intervalMinutes) {
      warnings.push({ kind: AdminWarningKind.REFRESH_LAG, level: refreshLagMinutes > intervalMinutes * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: refreshLagMinutes, threshold: intervalMinutes });
    }
    // scraperProxies was already fetched once above, in the same branch that
    // set productDataProvider to SCRAPER — never re-fetched here.
    const achievable = productDataProvider === ProductDataProviderKind.SCRAPER && scraperProxies
      ? achievableSyncsPerDay(
          scraperProxies.length,
          await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS),
          uniqueRefreshedAsins,
          // The same reserve the refresh batch size keeps for creates.
          await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_RESERVE_PERCENT),
        )
      : null;

    return {
      generatedAt: new Date().toISOString(),
      queues: queueSummaries,
      keepaTokensLeft,
      llmFailureRatePct,
      warnings,
      productDataProvider,
      scraperStats,
      refreshLagMinutes,
      uniqueRefreshedAsins,
      achievableSyncsPerDay: achievable === null ? null : Math.round(achievable * 10) / 10,
    };
  }

  /**
   * Probes each proxy with a small, non-Amazon request so an operator can see
   * "did this actually connect" before or after saving `scraper.proxies` —
   * separate from `scraperStats.window1h.proxies`, which only reports real
   * Amazon traffic once a create/refresh job has used a proxy.
   *
   * `draft` (comma/newline-separated, the same grammar the setting itself
   * uses) tests entries the admin is about to save, without saving them.
   * Omitted, it tests the CURRENTLY SAVED list — decrypted server-side by
   * `ProductSourceService`, never returned here: only `ProxyVerifyResult.id`
   * (host:port) and the outcome reach the caller.
   */
  async verifyScraperProxies(draft?: string): Promise<ProxyVerifyResult[]> {
    const proxies = draft === undefined ? await this.productSource.proxies() : partitionProxyList(draft).valid;
    if (proxies.length === 0) {
      return [];
    }
    return this.scraperClient.verifyProxies(proxies);
  }

  // --- internals -------------------------------------------------------------

  private emptyCounts() {
    return {
      totalUsers: 0,
      activeEbayStores: 0,
      activeAmazonAccounts: 0,
      activeListings: 0,
      ordersLast30Days: 0,
    };
  }

  private async getCounts() {
    const [
      usersRows,
      ebayRows,
      amazonRows,
      listingsRows,
      ordersRows,
    ] = await Promise.all([
      this.databaseService.query<CountRow>('SELECT COUNT(*)::TEXT AS count FROM users'),
      this.databaseService.query<CountRow>(
        "SELECT COUNT(*)::TEXT AS count FROM ebay_accounts WHERE status = 'active'",
      ),
      this.databaseService.query<CountRow>('SELECT COUNT(*)::TEXT AS count FROM amazon_accounts'),
      this.databaseService.query<CountRow>(
        "SELECT COUNT(*)::TEXT AS count FROM listings WHERE status = 'active'",
      ),
      this.databaseService.query<CountRow>(
        "SELECT COUNT(*)::TEXT AS count FROM orders WHERE order_date >= NOW() - INTERVAL '30 days'",
      ),
    ]);
    return {
      totalUsers: this.parseIntSafe(usersRows[0]?.count),
      activeEbayStores: this.parseIntSafe(ebayRows[0]?.count),
      activeAmazonAccounts: this.parseIntSafe(amazonRows[0]?.count),
      activeListings: this.parseIntSafe(listingsRows[0]?.count),
      ordersLast30Days: this.parseIntSafe(ordersRows[0]?.count),
    };
  }

  /** Per-user count of active listings (proxy for listing quota usage). */
  private async getPerUserListingCounts(): Promise<number[]> {
    const rows = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM listings
       WHERE status = 'active' GROUP BY user_id`,
    );
    return rows.map((row) => this.parseIntSafe(row.count));
  }

  /** Per-user count of amazon buyer accounts (proxy for AO quota usage). */
  private async getPerUserAmazonAccountCounts(): Promise<number[]> {
    const rows = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM amazon_accounts GROUP BY user_id`,
    );
    return rows.map((row) => this.parseIntSafe(row.count));
  }

  /** Distribution of users by `users.status` (proxy for subscription status). */
  private async getAccountStatusDistribution() {
    const rows = await this.databaseService.query<{ status: string | null; count: number }>(
      `SELECT status, COUNT(*)::INT AS count FROM users GROUP BY status ORDER BY count DESC`,
    );
    return buildAccountStatusDistribution(rows);
  }

  /** Distribution of users by `users.role` (proxy for plan/access tier). */
  private async getAccessTierDistribution() {
    const rows = await this.databaseService.query<{ tier: string | null; count: number }>(
      `SELECT role AS tier, COUNT(*)::INT AS count FROM users GROUP BY role ORDER BY count DESC`,
    );
    return buildAccessTierDistribution(rows);
  }

  /** Total estimated cost (micro-USD) across all usage_events in the period. */
  private async getTotalCost(from: string, to: string) {
    const rows = await this.databaseService.query<{
      total_cost_micros: string | null;
      currency: string | null;
    }>(
      `SELECT SUM(estimated_cost_micros)::TEXT AS total_cost_micros, MAX(currency) AS currency
       FROM usage_events WHERE recorded_at >= $1 AND recorded_at < $2
         AND estimated_cost_micros IS NOT NULL`,
      [from, to],
    );
    const row = rows[0];
    if (!row) {
      return resolveCostTotal({ totalCostMicros: null, currency: null });
    }
    return resolveCostTotal({
      totalCostMicros: row.total_cost_micros,
      currency: row.currency,
    });
  }

  private resolvePeriod(fromIso: string | null, toIso: string | null): { from: string; to: string } {
    const now = new Date();
    const to = toIso && this.isValidIso(toIso) ? toIso : now.toISOString();
    // Default `from` to the start of the current month.
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const from = fromIso && this.isValidIso(fromIso) ? fromIso : defaultFrom;
    return { from, to };
  }

  private isValidIso(s: string): boolean {
    const ms = Date.parse(s);
    return !Number.isNaN(ms);
  }

  private parseIntSafe(s: string | undefined): number {
    if (!s) {return 0;}
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  private errMsg(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
  }

  private mapObservationRow(row: QueueObservationRow): QueueObservationDto {
    return {
      id: row.id,
      queueName: row.queue_name,
      jobId: row.job_id,
      event: row.event,
      correlationId: row.correlation_id,
      jobName: row.job_name,
      attempts: Number.parseInt(row.attempts, 10) || 0,
      durationMs: row.duration_ms === null ? null : Number.parseInt(row.duration_ms, 10),
      errorMessage: row.error_message,
      payloadHash: row.payload_hash,
      recordedAt: row.recorded_at.toISOString(),
    };
  }

  private resolveObservationPeriod(fromIso?: string, toIso?: string): { from: string; to: string } {
    const now = new Date();
    return {
      from: fromIso && this.isValidIso(fromIso) ? fromIso : new Date(now.getTime() - 86400000).toISOString(),
      to: toIso && this.isValidIso(toIso) ? toIso : now.toISOString(),
    };
  }

  private clampLimit(raw?: number): number {
    if (!Number.isFinite(raw) || (raw ?? 0) <= 0) {return 50;}
    return Math.min(200, Math.floor(raw as number));
  }

  private clampPage(raw?: number): number {
    if (!Number.isFinite(raw) || (raw ?? 0) <= 0) {return 1;}
    return Math.floor(raw as number);
  }
}
