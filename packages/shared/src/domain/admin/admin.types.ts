// packages/shared/src/domain/admin/admin.types.ts

/**
 * Source system that emitted a {@link UsageEvent} row.
 *
 * Usage events are an append-only, source-of-truth stream for observability and
 * cost attribution. Each source owns a disjoint set of metric kinds so joins do
 * not double-count.
 */
export enum UsageEventSource {
  /** Keepa product-refresh pipeline (token consumption per ASIN). */
  KEEPA = 'keepa',
  /** Shared LLM transport (prompt/completion/embedding tokens per call). */
  LLM = 'llm',
  /** Amazon scraping / auto-fulfill checkout (browser actions, proxy bandwidth). */
  AMAZON = 'amazon',
  /** eBay Sell API (listing publishes, order sync calls). */
  EBAY = 'ebay',
  /** Residential proxy egress. Seam only until real provider usage is available. */
  PROXY = 'proxy',
  /** Tracking carrier conversion. Seam only until an API provider is enabled. */
  TRACKING = 'tracking',
}

/**
 * Kind of metered event within a {@link UsageEventSource}.
 *
 * Stored as VARCHAR; the (source, metric) pair uniquely identifies a metering
 * stream. New metrics must be added here first — never as a raw string.
 */
export enum UsageMetric {
  // Keepa
  KEEPA_TOKENS = 'keepa_tokens',
  // LLM
  LLM_PROMPT_TOKENS = 'llm_prompt_tokens',
  LLM_COMPLETION_TOKENS = 'llm_completion_tokens',
  LLM_EMBEDDING_TOKENS = 'llm_embedding_tokens',
  // Amazon
  AMAZON_BROWSER_ACTIONS = 'amazon_browser_actions',
  // eBay
  EBAY_API_CALLS = 'ebay_api_calls',
  // Proxy/tracking seams — no synthetic usage is emitted.
  PROXY_BYTES = 'proxy_bytes',
  PROXY_REQUESTS = 'proxy_requests',
  TRACKING_CONVERSIONS = 'tracking_conversions',
}

/**
 * Allocation method for a {@link SharedCostEntry} — how a shared cost is split
 * across tenants (users) for a billing period.
 */
export enum SharedCostAllocationMethod {
  /** Split evenly across active tenants in the period. */
  EVEN_SPLIT = 'even_split',
  /** Split proportional to a usage metric (e.g. LLM tokens). */
  USAGE_WEIGHTED = 'usage_weighted',
  /** Fixed manual allocation (precomputed shares in {@link SharedCostEntry.customShares}). */
  MANUAL = 'manual',
}

/** A single point-in-time metric emission for the usage stream. */
export interface UsageEventDto {
  id: string;
  /** Tenant that incurred the usage (NULL for platform-level shared usage). */
  userId: string | null;
  source: UsageEventSource;
  metric: UsageMetric;
  /** Quantity consumed (tokens, calls, actions, etc.). Always non-negative. */
  quantity: number;
  /** ISO 8601 timestamp of when the event was recorded. */
  recordedAt: string;
  /** Optional reference to the originating provider row (e.g. llm_usage_log.id). */
  providerRefId: string | null;
  /** Micro-USD estimated cost attributed at write time (1/1,000,000 USD). Null = unknown. */
  estimatedCostMicros: number | null;
  /** Currency code for estimatedCostMicros (e.g. 'USD'). Null when cost is null. */
  currency: string | null;
}

/** Aggregated usage summary for the admin overview endpoint. */
export interface UsageSummaryDto {
  source: UsageEventSource;
  metric: UsageMetric;
  /** Total quantity in the requested period. */
  totalQuantity: number;
  /** Total estimated cost (micro-USD) in the period; null if no cost rows. */
  totalCostMicros: number | null;
  /** Currency for totalCostMicros; null if no cost rows. */
  currency: string | null;
  /** Number of distinct tenants that incurred usage for this (source, metric). */
  tenantCount: number;
}

/** Health summary for a single BullMQ queue. */
export interface QueueHealthDto {
  /** Queue name (e.g. 'order-sync', 'auto-fulfill'). */
  name: string;
  /** Number of waiting jobs. */
  waiting: number;
  /** Number of active jobs. */
  active: number;
  /** Number of completed jobs (since last cleanup). */
  completed: number;
  /** Number of failed jobs (since last cleanup). */
  failed: number;
  /** Number of delayed jobs. */
  delayed: number;
  /** Number of jobs in the priority set. */
  prioritized: number;
}

/** Top-level admin overview payload returned by GET /admin/overview. */
export interface AdminOverviewDto {
  /** ISO 8601 timestamp the overview was generated at. */
  generatedAt: string;
  /** Total user accounts (all statuses). */
  totalUsers: number;
  /** Active eBay stores (accounts with status active). */
  activeEbayStores: number;
  /** Active Amazon buyer accounts. */
  activeAmazonAccounts: number;
  /** Active (non-draft, non-ended) listings across all stores. */
  activeListings: number;
  /** Orders in the last 30 days across all stores. */
  ordersLast30Days: number;
  /** Usage summaries grouped by (source, metric) for the requested period. */
  usage: UsageSummaryDto[];
  /** BullMQ queue health snapshots. */
  queues: QueueHealthDto[];
}

/** Query params for GET /admin/overview. */
export interface AdminOverviewQuery {
  /** Usage period start (ISO 8601). Defaults to start of current month. */
  from?: string;
  /** Usage period end (ISO 8601). Defaults to now. */
  to?: string;
}

/** Query params for GET /admin/usage/summaries. */
export interface UsageSummariesQuery {
  /** Filter by source. */
  source?: UsageEventSource;
  /** Filter by metric. */
  metric?: UsageMetric;
  /** Period start (ISO 8601). */
  from?: string;
  /** Period end (ISO 8601). */
  to?: string;
}

/** A shared cost entry with effective dates (FinOps pricing/allocation). */
export interface SharedCostEntryDto {
  id: string;
  /** Human-readable label (e.g. "Residential proxy — July 2026"). */
  label: string;
  /** Allocation method used to split this cost across tenants. */
  allocationMethod: SharedCostAllocationMethod;
  /** Total cost in micro-USD (1/1,000,000 USD). Always positive. */
  totalCostMicros: number;
  /** Currency code (e.g. 'USD'). */
  currency: string;
  /** Effective start (inclusive). ISO 8601. */
  effectiveFrom: string;
  /** Effective end (exclusive); null = open-ended. ISO 8601. */
  effectiveTo: string | null;
  /** ISO 8601 row creation timestamp. */
  createdAt: string;
}

export enum UsageCostKind {
  ESTIMATED = 'estimated',
  ACTUAL = 'actual',
  ADJUSTED = 'adjusted',
}

/** Typed input for an append-only usage ledger event. */
export interface UsageEventParams {
  source: UsageEventSource;
  metric: UsageMetric;
  providerRefId: string;
  userId?: string | null;
  quantity: number;
  estimatedCostMicros?: number | null;
  currency?: string | null;
  costKind?: UsageCostKind;
  recordedAt?: Date;
  metadata?: Record<string, unknown> | null;
}

/** Fail-soft result returned by usage ledger writes. */
export interface UsageEventAppendResult {
  inserted: boolean;
  idempotentSkip: boolean;
  failed: boolean;
  error?: string;
}

/** Compute micro-USD cost from a per-million rate. */
export function computeMicroCost(quantity: number, perMillionMicros: number | null | undefined): number | null {
  if (perMillionMicros === null || perMillionMicros === undefined) {return null;}
  if (!Number.isFinite(quantity) || quantity < 0) {return null;}
  if (!Number.isFinite(perMillionMicros) || perMillionMicros < 0) {return null;}
  return Math.round((quantity * perMillionMicros) / 1_000_000);
}

export enum AdminWarningKind {
  QUEUE_WAITING = 'queue_waiting',
  KEEPA_LOW_TOKENS = 'keepa_low_tokens',
  LLM_FAILURE_RATE = 'llm_failure_rate',
}

export enum AdminWarningLevel {
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface AdminWarningDto {
  kind: AdminWarningKind;
  level: AdminWarningLevel;
  value: number;
  threshold: number;
  subject?: string;
}

export interface UserCostSummaryDto {
  userId: string | null;
  totalQuantity: number;
  totalCostMicros: number | null;
  currency: string | null;
}

export interface ProviderCostSummaryDto {
  source: UsageEventSource;
  metric: UsageMetric;
  totalQuantity: number;
  totalCostMicros: number | null;
  currency: string | null;
}

export interface QueueOperationSummaryDto extends QueueHealthDto {
  completedObserved: number;
  failedObserved: number;
  failureRatePct: number;
  averageDurationMs: number | null;
}

export interface AdminOperationsSummaryDto {
  generatedAt: string;
  queues: QueueOperationSummaryDto[];
  keepaTokensLeft: number | null;
  llmFailureRatePct: number;
  warnings: AdminWarningDto[];
}

export interface FairShareAllocation {
  userId: string;
  tokens: number;
}

/** Deterministically split a token total without losing rounding residue. */
export function fairSplitTokens(totalTokens: number, userIds: string[]): FairShareAllocation[] {
  if (!Number.isFinite(totalTokens) || totalTokens < 0) {return [];}
  const users = Array.from(new Set(userIds.filter((userId) => userId.length > 0))).sort();
  if (users.length === 0) {return [];}
  const totalMilli = Math.round(totalTokens * 1000);
  const baseShare = Math.floor(totalMilli / users.length);
  let residue = totalMilli - baseShare * users.length;
  return users.map((userId) => {
    const extra = residue > 0 ? 1 : 0;
    residue -= extra;
    return { userId, tokens: (baseShare + extra) / 1000 };
  });
}

export function fairSplitBalances(totalTokens: number, allocations: FairShareAllocation[]): boolean {
  if (!Number.isFinite(totalTokens) || totalTokens < 0) {return allocations.length === 0;}
  const sum = allocations.reduce((total, allocation) => total + allocation.tokens, 0);
  return Math.abs(sum - totalTokens) < 0.0001;
}

// ---------------------------------------------------------------------------
// Billing metrics (read-only admin)
// ---------------------------------------------------------------------------

/**
 * Pressure band for a quota usage summary.
 *
 * Bands are derived from soft, env-configurable thresholds (there is no plan
 * table today). `nearLimit` and `atLimit` are mutually exclusive bands that
 * sit just below / at the configured cap; `overLimit` exceeds it.
 */
export enum QuotaPressureBand {
  /** 0 usage — no pressure. */
  NONE = 'none',
  /** Usage below the warn threshold. */
  UNDER_LIMIT = 'under_limit',
  /** Usage at or above the warn threshold but below the critical threshold. */
  NEAR_LIMIT = 'near_limit',
  /** Usage at or above the critical threshold. */
  AT_LIMIT = 'at_limit',
  /** Usage above the critical threshold (over the soft cap). */
  OVER_LIMIT = 'over_limit',
}

/** Count of users in a single {@link QuotaPressureBand}. */
export interface QuotaBandCountDto {
  band: QuotaPressureBand;
  /** Number of users whose usage fell into this band. */
  userCount: number;
}

/** Quota usage-pressure summary for one resource kind (listings or amazon accounts). */
export interface QuotaPressureSummaryDto {
  /**
   * Resource kind: `'listings'` (active listings per user) or
   * `'amazon_accounts'` (amazon buyer accounts per user).
   */
  resource: 'listings' | 'amazon_accounts';
  /** Total users with at least one unit of usage for this resource. */
  usersWithUsage: number;
  /** Per-band user counts. Bands with zero users are still emitted. */
  bands: QuotaBandCountDto[];
  /**
   * Warn threshold used to derive bands (env-configurable soft cap). Always
   * present — it is the configured value, never null.
   */
  warnThreshold: number;
  /** Critical threshold used to derive bands. Always present. */
  criticalThreshold: number;
  /**
   * Highest per-user usage observed for this resource. Null only when no user
   * has any usage (empty table); never faked as 0 when unknown.
   */
  maxUsage: number | null;
}

/**
 * Account status distribution entry — the closest existing proxy for
 * subscription status counts (there is no subscriptions table). Sourced from
 * `users.status`.
 */
export interface AccountStatusCountDto {
  /** User status value (matches {@link UserStatus}). */
  status: string;
  /** Number of users in this status. */
  count: number;
}

/**
 * Access-tier distribution entry — the closest existing proxy for plan
 * distribution (there is no plans/subscriptions table). Sourced from
 * `users.role`.
 */
export interface AccessTierCountDto {
  /** User role value (matches {@link UserRole}). */
  tier: string;
  /** Number of users in this tier. */
  count: number;
}

/** Aggregate billing metrics payload returned by GET /admin/billing/metrics. */
export interface AdminBillingMetricsDto {
  /** ISO 8601 timestamp the metrics were generated at. */
  generatedAt: string;
  /**
   * Account status distribution (proxy for subscription status). Sourced from
   * `users.status`. Empty array only when the users table is empty.
   */
  accountStatusDistribution: AccountStatusCountDto[];
  /**
   * Access-tier distribution (proxy for plan distribution). Sourced from
   * `users.role`. Empty array only when the users table is empty.
   */
  accessTierDistribution: AccessTierCountDto[];
  /**
   * Per-resource quota usage-pressure summaries. Always contains entries for
   * both `listings` and `amazon_accounts`.
   */
  quotaPressure: QuotaPressureSummaryDto[];
  /**
   * Total estimated cost (micro-USD) across all usage_events in the period.
   * Null when no cost rows exist (never faked as 0 when unknown).
   */
  totalEstimatedCostMicros: number | null;
  /** Currency for totalEstimatedCostMicros; null when no cost rows exist. */
  currency: string | null;
  /** Period start (ISO 8601) used for the cost total. */
  from: string;
  /** Period end (ISO 8601) used for the cost total. */
  to: string;
}

/** Query params for GET /admin/billing/metrics. */
export interface AdminBillingMetricsQuery {
  /** Cost-period start (ISO 8601). Defaults to start of current month. */
  from?: string;
  /** Cost-period end (ISO 8601). Defaults to now. */
  to?: string;
}
