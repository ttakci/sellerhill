// apps/api/src/modules/admin/proxy-pool.helpers.ts
//
// Pure helpers for the admin proxy pool surface: expiry classification and
// pool summary aggregation. No I/O — unit-tested in proxy-pool.helpers.spec.ts.

import { ProxyExpiryState, ProxyStatus, type AdminProxyDto, type AdminProxyPoolSummaryDto } from '@repo/shared';

const MS_PER_DAY = 86_400_000;

/** Expiry classification derived once server-side (badges + warnings share it). */
export interface ProxyExpiryClassification {
  state: ProxyExpiryState;
  /** Whole days until expiry, floored; negative when overdue. Null without an expiry. */
  daysUntilExpiry: number | null;
}

/**
 * Classify a proxy's expiry relative to `now`. `warnDays` is the operator
 * warn window (ADMIN_PROXY_EXPIRY_WARN_DAYS): an expiry within that many days
 * is EXPIRING_SOON. A past expiry is EXPIRED regardless of the window.
 */
export function classifyProxyExpiry(
  expiresAt: Date | null,
  now: Date,
  warnDays: number,
): ProxyExpiryClassification {
  if (!expiresAt) {
    return { state: ProxyExpiryState.NO_EXPIRY, daysUntilExpiry: null };
  }
  const days = Math.floor((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (days < 0) {
    return { state: ProxyExpiryState.EXPIRED, daysUntilExpiry: days };
  }
  if (days <= warnDays) {
    return { state: ProxyExpiryState.EXPIRING_SOON, daysUntilExpiry: days };
  }
  return { state: ProxyExpiryState.OK, daysUntilExpiry: days };
}

/**
 * Aggregate pool health from already-classified rows. Cost total sums only
 * ACTIVE rows with a known cost — null (unknown) rows are excluded, never
 * counted as 0; a pool with no known costs reports null, not 0.
 */
export function buildProxyPoolSummary(
  proxies: AdminProxyDto[],
  expiryWarnDays: number,
): AdminProxyPoolSummaryDto {
  const active = proxies.filter((p) => p.status === ProxyStatus.ACTIVE);
  const knownCosts = active.filter((p) => p.monthlyCostMicros !== null);
  const totalMonthlyCostMicros =
    knownCosts.length === 0
      ? null
      : knownCosts.reduce((sum, p) => sum + (p.monthlyCostMicros as number), 0);
  return {
    totalProxies: proxies.length,
    activeProxies: active.length,
    disabledProxies: proxies.length - active.length,
    assignedProxies: active.filter((p) => p.assignedUserId !== null).length,
    freeActiveProxies: active.filter((p) => p.assignedUserId === null).length,
    expiringSoon: active.filter((p) => p.expiryState === ProxyExpiryState.EXPIRING_SOON).length,
    expired: active.filter((p) => p.expiryState === ProxyExpiryState.EXPIRED).length,
    totalMonthlyCostMicros,
    currency: totalMonthlyCostMicros === null ? null : (knownCosts[0]?.currency ?? 'USD'),
    expiryWarnDays,
  };
}
