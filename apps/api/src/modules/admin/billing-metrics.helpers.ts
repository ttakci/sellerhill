// apps/api/src/modules/admin/billing-metrics.helpers.ts
//
// Pure billing-metrics helpers — no I/O, no NestJS deps. Jest-covered by
// `billing-metrics.helpers.spec.ts` (same pure-helper pattern as
// `finops-helpers.ts` / `orders/profit-calculation.ts`). The admin service
// calls these with rows fetched from `users`, `listings`, `amazon_accounts`,
// and `usage_events`.
//
// Invariants enforced here:
//   - Quota band classification is total/monotonic: every non-negative usage
//     value maps to exactly one band, and band boundaries never overlap.
//   - Distribution aggregation preserves the input total (sum of counts ==
//     number of input rows).
//   - Unknown financial data (no cost rows) is surfaced as null, never 0.

import {
  QuotaPressureBand,
  type AccountStatusCountDto,
  type AccessTierCountDto,
  type QuotaBandCountDto,
  type QuotaPressureSummaryDto,
} from '@repo/shared';

/**
 * Classify a per-user usage value into a {@link QuotaPressureBand}.
 *
 * Bands (monotonic, total):
 *   - NONE          — usage === 0
 *   - UNDER_LIMIT   — 0 < usage < warn
 *   - NEAR_LIMIT    — warn <= usage < critical
 *   - AT_LIMIT      — usage === critical
 *   - OVER_LIMIT    — usage > critical
 *
 * `warn` and `critical` must be finite positive numbers with warn <= critical;
 * otherwise every positive value is classified as UNDER_LIMIT (fail-safe — no
 * band is silently inflated to a higher pressure).
 */
export function classifyQuotaBand(
  usage: number,
  warn: number,
  critical: number,
): QuotaPressureBand {
  if (!Number.isFinite(usage) || usage < 0) {
    // Defensive: treat invalid usage as no pressure rather than throwing.
    return QuotaPressureBand.NONE;
  }
  if (usage === 0) {
    return QuotaPressureBand.NONE;
  }
  const warnOk = Number.isFinite(warn) && warn > 0;
  const critOk = Number.isFinite(critical) && critical > 0;
  if (!warnOk || !critOk || warn > critical) {
    return QuotaPressureBand.UNDER_LIMIT;
  }
  if (usage < warn) {
    return QuotaPressureBand.UNDER_LIMIT;
  }
  if (usage < critical) {
    return QuotaPressureBand.NEAR_LIMIT;
  }
  if (usage === critical) {
    return QuotaPressureBand.AT_LIMIT;
  }
  return QuotaPressureBand.OVER_LIMIT;
}

/** Ordered list of every {@link QuotaPressureBand}, used to guarantee the
 * service emits a count for every band (including zero-count bands). */
export const ALL_QUOTA_BANDS: readonly QuotaPressureBand[] = [
  QuotaPressureBand.NONE,
  QuotaPressureBand.UNDER_LIMIT,
  QuotaPressureBand.NEAR_LIMIT,
  QuotaPressureBand.AT_LIMIT,
  QuotaPressureBand.OVER_LIMIT,
] as const;

/**
 * Aggregate an array of per-user usage values into a band distribution.
 *
 * Returns one {@link QuotaBandCountDto} per band (bands with zero users are
 * still emitted so the UI can render a stable layout). `maxUsage` is null only
 * when the input is empty; otherwise it is the maximum value (which may be 0
 * if every user has zero usage).
 */
export function aggregateQuotaBands(
  usages: number[],
  warn: number,
  critical: number,
): { bands: QuotaBandCountDto[]; maxUsage: number | null; usersWithUsage: number } {
  const counts = new Map<QuotaPressureBand, number>();
  for (const band of ALL_QUOTA_BANDS) {
    counts.set(band, 0);
  }
  let maxUsage: number | null = null;
  let usersWithUsage = 0;
  for (const usage of usages) {
    const band = classifyQuotaBand(usage, warn, critical);
    counts.set(band, (counts.get(band) ?? 0) + 1);
    if (usage > 0) {
      usersWithUsage += 1;
    }
    if (maxUsage === null || usage > maxUsage) {
      maxUsage = usage;
    }
  }
  const bands: QuotaBandCountDto[] = ALL_QUOTA_BANDS.map((band) => ({
    band,
    userCount: counts.get(band) ?? 0,
  }));
  return { bands, maxUsage, usersWithUsage };
}

/**
 * Build a {@link QuotaPressureSummaryDto} from raw per-user usage values.
 *
 * `usages` is one entry per user (including users with zero usage when the
 * caller chose to include them — the service passes counts for ALL users so
 * the NONE band surfaces dormant accounts). `maxUsage` is null only when the
 * input is empty (no users at all).
 */
export function buildQuotaPressureSummary(
  resource: 'listings' | 'amazon_accounts',
  usages: number[],
  warn: number,
  critical: number,
): QuotaPressureSummaryDto {
  const { bands, maxUsage, usersWithUsage } = aggregateQuotaBands(usages, warn, critical);
  return {
    resource,
    usersWithUsage,
    bands,
    warnThreshold: warn,
    criticalThreshold: critical,
    maxUsage,
  };
}

/**
 * Aggregate raw `status -> count` rows into an account status distribution.
 *
 * Rows with a null/empty status are dropped (defensive — the users table
 * `status` column has a default but is nullable in older schemas). The order
 * of the output follows the input order.
 */
export function buildAccountStatusDistribution(
  rows: Array<{ status: string | null; count: number }>,
): AccountStatusCountDto[] {
  const out: AccountStatusCountDto[] = [];
  for (const row of rows) {
    if (row.status === null || row.status === '') {
      continue;
    }
    out.push({ status: row.status, count: row.count });
  }
  return out;
}

/**
 * Aggregate raw `tier -> count` rows into an access-tier distribution.
 *
 * Rows with a null/empty tier are dropped. The order of the output follows the
 * input order.
 */
export function buildAccessTierDistribution(
  rows: Array<{ tier: string | null; count: number }>,
): AccessTierCountDto[] {
  const out: AccessTierCountDto[] = [];
  for (const row of rows) {
    if (row.tier === null || row.tier === '') {
      continue;
    }
    out.push({ tier: row.tier, count: row.count });
  }
  return out;
}

/**
 * Resolve a micro-USD cost total from a raw aggregate row.
 *
 * Returns `{ totalCostMicros: null, currency: null }` when the input has no
 * cost (null total) — never fakes a zero. When the total is present, the
 * currency must also be present; otherwise the cost is treated as unknown
 * (null).
 */
export function resolveCostTotal(row: {
  totalCostMicros: string | null;
  currency: string | null;
}): { totalCostMicros: number | null; currency: string | null } {
  if (row.totalCostMicros === null) {
    return { totalCostMicros: null, currency: null };
  }
  const parsed = Number.parseInt(row.totalCostMicros, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { totalCostMicros: null, currency: null };
  }
  if (row.currency === null || row.currency === '') {
    return { totalCostMicros: null, currency: null };
  }
  return { totalCostMicros: parsed, currency: row.currency };
}
