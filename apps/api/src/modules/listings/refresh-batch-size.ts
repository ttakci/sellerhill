// apps/api/src/modules/listings/refresh-batch-size.ts
//
// Derive the refresh batch size from the Keepa plan's own refill rate.
//
// Why this exists: the scheduler ticks once a minute and claims up to
// `batchSize` products (see RefreshProcessorService.selectRefreshBatch), so
// `batchSize` IS the per-minute refresh throughput. Keepa meters us per minute
// too (`refill_rate` = tokens/minute, captured from every response into
// `keepa_balance`). The two must be matched:
//
//   - batchSize too HIGH → we ask for more tokens than the plan refills and
//     burn the retry budget on Keepa 429s.
//   - batchSize too LOW  → products go stale. Nothing errors; the configured
//     refresh interval silently stretches, because each tick can only take
//     `batchSize` of the products that are already due.
//
// Keeping them matched by hand means remembering to edit a second setting
// every time the Keepa plan changes — exactly the kind of step that gets
// forgotten and then degrades quietly. So the batch size is derived from the
// plan by default, with a manual override retained for operators.
//
// A reserve is held back for the CREATE path (a seller adding listings right
// now), mirroring how EbayCallBudgetService reserves headroom so background
// work can never starve an interactive request.

/** Tokens a single product refresh costs: `offers` page (6) + `stock=1` (2). */
export const KEEPA_TOKENS_PER_REFRESH = 8;

export interface ResolveBatchSizeInput {
  /** Keepa plan tokens/minute, from `keepa_balance.refill_rate`. Null when no
   *  response has been captured yet (fresh install, or Keepa never called). */
  refillRate: number | null;
  /** Percent of the refill rate held back for the create path (0-90). */
  reservePercent: number;
  /** The operator-set value, used when auto is off or the rate is unknown. */
  manualBatchSize: number;
  /** Whether to derive from the plan at all. */
  autoEnabled: boolean;
  /** Registry bounds for the batch-size setting. */
  min: number;
  max: number;
}

export interface ResolvedBatchSize {
  batchSize: number;
  /** Where the number came from — logged so an operator can see which path ran. */
  source: 'auto' | 'manual' | 'manual_no_rate';
}

/**
 * Resolve the batch size for one scheduler tick. Pure — no DB, no config
 * reads, so the policy is unit-testable on its own.
 *
 * Auto formula: `floor(refillRate * (1 - reserve) / tokensPerRefresh)`, then
 * clamped to the registry bounds. The result is deliberately floored, never
 * rounded up: overshooting the refill rate is the failure mode that costs
 * real money in retries, while undershooting only slows the cycle slightly.
 */
export function resolveRefreshBatchSize(input: ResolveBatchSizeInput): ResolvedBatchSize {
  const { refillRate, reservePercent, manualBatchSize, autoEnabled, min, max } = input;

  if (!autoEnabled) {
    return { batchSize: clamp(manualBatchSize, min, max), source: 'manual' };
  }
  // No captured balance yet — fall back to the operator value rather than
  // guessing a rate. This is the state on a fresh install, before the first
  // Keepa call has returned a `refillRate`.
  if (refillRate === null || !Number.isFinite(refillRate) || refillRate <= 0) {
    return { batchSize: clamp(manualBatchSize, min, max), source: 'manual_no_rate' };
  }

  const reserve = clamp(reservePercent, 0, 90) / 100;
  const usableTokensPerMinute = refillRate * (1 - reserve);
  const derived = Math.floor(usableTokensPerMinute / KEEPA_TOKENS_PER_REFRESH);
  return { batchSize: clamp(derived, min, max), source: 'auto' };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {return min;}
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * Products a plan can keep refreshed at a given interval — the capacity
 * question ("can we still honour 12h at this many active listings?") that the
 * batch size answers per minute. Exposed for operator diagnostics.
 */
export function maxProductsAtInterval(refillRate: number, intervalMinutes: number, reservePercent = 0): number {
  if (refillRate <= 0 || intervalMinutes <= 0) {return 0;}
  const usable = refillRate * (1 - clamp(reservePercent, 0, 90) / 100);
  const refreshesPerMinute = usable / KEEPA_TOKENS_PER_REFRESH;
  return Math.floor(refreshesPerMinute * intervalMinutes);
}
