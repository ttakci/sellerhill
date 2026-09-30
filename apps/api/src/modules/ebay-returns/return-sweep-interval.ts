// apps/api/src/modules/ebay-returns/return-sweep-interval.ts
//
// How often each store's returns are read, derived from what it costs.
//
// A sweep is ONE eBay call per store, against `post-order.return` — a quota
// eBay sets for the whole application, not per seller. So the interval is not
// a preference, it is arithmetic: `stores × 24 / interval` calls a day must
// fit the share of the quota the sweep is allowed to spend. A fixed interval
// is right for exactly one store count; with a fixed 1 hour the quota runs out
// at ~200 stores, with a fixed 6 hours a single store waits six times longer
// than it has to. Same idea as `resolveRefreshBatchSize` for the product
// refresh: derive the pace from the capacity.
//
// Pure — no DB, no settings, no clock — so the policy is unit-testable alone.

/** Never more often than this: a return's deadlines are counted in days. */
export const RETURN_SWEEP_MIN_INTERVAL_HOURS = 1;
/** Never less often than this (the registry's bound for the manual value too). */
export const RETURN_SWEEP_MAX_INTERVAL_HOURS = 168;

const HOURS_PER_DAY = 24;

export type ReturnSweepIntervalSource =
  /** Derived from the store count and eBay's reported daily limit. */
  | 'auto'
  /** The operator switched the derivation off. */
  | 'manual'
  /** Auto is on, but eBay has not reported a limit for the resource yet. */
  | 'manual_no_limit';

export interface ResolveReturnSweepIntervalInput {
  autoEnabled: boolean;
  /** `ebay.returnSync.intervalHours` — used when auto is off or no limit is known. */
  manualIntervalHours: number;
  /** Stores the sweep actually reads (ACTIVE eBay accounts). */
  activeStores: number;
  /**
   * What background work may spend on the resource per day — eBay's reported
   * daily limit after the interactive reserve — or null when eBay has never
   * reported one. Never a figure we made up.
   */
  dailyCeiling: number | null;
  /** `ebay.returnSync.quotaPercent` — how much of that ceiling the sweep may use. */
  quotaSharePercent: number;
}

export interface ResolvedReturnSweepInterval {
  intervalHours: number;
  source: ReturnSweepIntervalSource;
  /** Calls a day the sweep makes at this interval with this many stores. */
  estimatedDailyCalls: number;
}

function clampInterval(hours: number): number {
  if (!Number.isFinite(hours)) {
    return RETURN_SWEEP_MAX_INTERVAL_HOURS;
  }
  return Math.min(Math.max(Math.ceil(hours), RETURN_SWEEP_MIN_INTERVAL_HOURS), RETURN_SWEEP_MAX_INTERVAL_HOURS);
}

function withEstimate(
  intervalHours: number,
  source: ReturnSweepIntervalSource,
  activeStores: number
): ResolvedReturnSweepInterval {
  return {
    intervalHours,
    source,
    estimatedDailyCalls: Math.ceil((activeStores * HOURS_PER_DAY) / intervalHours),
  };
}

/**
 * Auto formula: `ceil(stores × 24 / (dailyCeiling × share))`, clamped to
 * 1–168 hours. Always rounded UP: overshooting the quota stops the sweep for
 * every seller until eBay's counter resets, while undershooting only makes a
 * return appear a little later.
 */
export function resolveReturnSweepInterval(input: ResolveReturnSweepIntervalInput): ResolvedReturnSweepInterval {
  const stores = Number.isFinite(input.activeStores) && input.activeStores > 0 ? Math.floor(input.activeStores) : 0;
  const manual = clampInterval(input.manualIntervalHours);

  if (!input.autoEnabled) {
    return withEstimate(manual, 'manual', stores);
  }
  // eBay has not told us a limit (a fresh install before the first
  // getRateLimits, or a keyset without the resource): fall back to the
  // operator value rather than inventing a ceiling.
  if (input.dailyCeiling === null || !Number.isFinite(input.dailyCeiling) || input.dailyCeiling <= 0) {
    return withEstimate(manual, 'manual_no_limit', stores);
  }

  const share = Math.min(Math.max(Number.isFinite(input.quotaSharePercent) ? input.quotaSharePercent : 0, 1), 100);
  const dailyBudget = Math.floor((input.dailyCeiling * share) / 100);
  if (dailyBudget < 1) {
    // A share so small it buys no call: sweep as rarely as allowed.
    return withEstimate(RETURN_SWEEP_MAX_INTERVAL_HOURS, 'auto', stores);
  }
  return withEstimate(clampInterval((stores * HOURS_PER_DAY) / dailyBudget), 'auto', stores);
}
