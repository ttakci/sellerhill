// apps/api/src/modules/admin/finops-helpers.ts
//
// Pure FinOps helpers — no I/O, no NestJS deps. Jest-covered by
// `finops-helpers.spec.ts` (same pure-helper pattern as
// `orders/profit-calculation.ts`). The module service calls these with rows
// fetched from `llm_model_pricing` (effective-date resolution) and
// `shared_cost_entries` (shared-cost allocation).
//
// Invariants enforced here:
//   - Effective-date resolution: at most one row covers any instant; ties
//     (duplicate open-ended or overlapping windows) are resolved by latest
//     `effective_from`.
//   - Shared-cost allocation: sum of shares equals the input total modulo a
//     residue strictly less than the number of tenants (micro-USD rounding).
//     The residue is returned so the caller can attribute it (e.g. to the
//     first tenant) if exact reconciliation is required.

import {
  FINOPS_DEFAULT_CURRENCY,
  SharedCostAllocationMethod,
  type ProviderPricingRow,
  type ResolvedPricing,
  type SharedCostAllocationInput,
  type SharedCostAllocationResult,
} from '@repo/shared';

/**
 * Resolve the pricing row effective at the given instant.
 *
 * A row covers an instant `t` when `effective_from <= t` AND
 * (`effective_to IS NULL` OR `effective_to > t`). When multiple rows cover
 * `t` (data error — the unique partial index should prevent open-ended
 * duplicates but overlapping closed windows are still possible), the row with
 * the latest `effective_from` wins.
 *
 * @param rows Candidate pricing rows for a (provider, model, currency).
 * @param atIso ISO-8601 instant; `null` resolves to the current instant.
 * @returns `{ row, isPriced }` — `isPriced` is false when no row covers `t`.
 */
export function resolveEffectivePricing(
  rows: ProviderPricingRow[],
  atIso: string | null,
): ResolvedPricing {
  if (rows.length === 0) {
    return { row: null, isPriced: false };
  }

  const atMs = atIso === null ? Date.now() : Date.parse(atIso);
  // An unparseable timestamp is treated as "no row covers it" — fail safe
  // (unpriced) rather than silently picking the wrong row.
  if (Number.isNaN(atMs)) {
    return { row: null, isPriced: false };
  }

  const covering = rows.filter((r) => {
    const fromMs = Date.parse(r.effectiveFrom);
    if (Number.isNaN(fromMs) || fromMs > atMs) {
      return false;
    }
    if (r.effectiveTo === null) {
      return true;
    }
    const toMs = Date.parse(r.effectiveTo);
    if (Number.isNaN(toMs)) {
      return false;
    }
    return toMs > atMs;
  });

  if (covering.length === 0) {
    return { row: null, isPriced: false };
  }

  // Tie-break: latest effective_from wins (most recently introduced price).
  covering.sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
  return { row: covering[0], isPriced: true };
}

/**
 * Compute the micro-USD cost of a usage quantity given a pricing row.
 *
 * @param row        The effective pricing row (input/output/embedding per-million costs).
 * @param quantity   Number of units consumed.
 * @param costType   Which per-million rate to apply: 'input' | 'output' | 'embedding'.
 * @returns Micro-USD cost (rounded to nearest micro), or `null` when the row
 *          is null (unpriced) or the rate is zero and quantity is zero.
 */
export function computeUsageCostMicros(
  row: ProviderPricingRow | null,
  quantity: number,
  costType: 'input' | 'output' | 'embedding',
): number | null {
  if (row === null) {
    return null;
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    return null;
  }
  const perMillion =
    costType === 'input'
      ? row.inputCostPerMillionMicros
      : costType === 'output'
        ? row.outputCostPerMillionMicros
        : row.embeddingCostPerMillionMicros;
  if (!Number.isFinite(perMillion) || perMillion < 0) {
    return null;
  }
  // quantity units * (perMillion / 1_000_000) = micro-USD cost.
  // Round to nearest micro (positive residue goes up for any fractional micro).
  return Math.round((quantity * perMillion) / 1_000_000);
}

/**
 * Allocate a shared cost across tenants.
 *
 * - `even_split`: each tenant gets `floor(total / n)`; residue (< n micros)
 *   is returned in `residueMicros` for the caller to attribute.
 * - `usage_weighted`: share = `floor(total * weight / sumWeights)`; residue
 *   returned. Weights of 0 are allowed (they receive 0). When `sumWeights`
 *   is 0, falls back to even split (degenerate but defined).
 * - `manual`: returns empty shares + the full total as residue (the caller
 *   resolves manual shares out-of-band; this helper does not fabricate them).
 *
 * @returns `{ shares, allocatedTotalMicros, residueMicros }`.
 */
export function allocateSharedCost(input: SharedCostAllocationInput): SharedCostAllocationResult {
  const { totalCostMicros, method, tenants } = input;

  if (!Number.isFinite(totalCostMicros) || totalCostMicros < 0) {
    throw new Error(`allocateSharedCost: totalCostMicros must be finite and >= 0, got ${totalCostMicros}`);
  }
  if (!Array.isArray(tenants)) {
    throw new Error('allocateSharedCost: tenants must be an array');
  }
  const n = tenants.length;
  if (n === 0) {
    return { shares: [], allocatedTotalMicros: 0, residueMicros: totalCostMicros };
  }

  if (method === SharedCostAllocationMethod.MANUAL) {
    // Manual allocation is resolved by the caller (custom shares table).
    return { shares: [], allocatedTotalMicros: 0, residueMicros: totalCostMicros };
  }

  if (method === SharedCostAllocationMethod.EVEN_SPLIT) {
    const perTenant = Math.floor(totalCostMicros / n);
    const allocated = perTenant * n;
    const residue = totalCostMicros - allocated;
    return {
      shares: tenants.map((t) => ({ userId: t.userId, shareMicros: perTenant })),
      allocatedTotalMicros: allocated,
      residueMicros: residue,
    };
  }

  // USAGE_WEIGHTED
  const sumWeights = tenants.reduce((sum, t) => {
    const w = Number.isFinite(t.usageWeight) && t.usageWeight > 0 ? t.usageWeight : 0;
    return sum + w;
  }, 0);

  // Degenerate: no positive weight → fall back to even split so the cost is
  // still fully attributed (defined behavior, never silently drops cost).
  if (sumWeights === 0) {
    return allocateSharedCost({ ...input, method: SharedCostAllocationMethod.EVEN_SPLIT });
  }

  const shares = tenants.map((t) => {
    const w = Number.isFinite(t.usageWeight) && t.usageWeight > 0 ? t.usageWeight : 0;
    const share = Math.floor((totalCostMicros * w) / sumWeights);
    return { userId: t.userId, shareMicros: share };
  });
  const allocated = shares.reduce((sum, s) => sum + s.shareMicros, 0);
  const residue = totalCostMicros - allocated;
  return { shares, allocatedTotalMicros: allocated, residueMicros: residue };
}

/** Convenience: the currency every FinOps row defaults to when none is set. */
export const DEFAULT_FINOPS_CURRENCY = FINOPS_DEFAULT_CURRENCY;
