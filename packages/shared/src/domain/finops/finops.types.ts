// packages/shared/src/domain/finops/finops.types.ts

import type { SharedCostAllocationMethod } from '../admin/admin.types';

/**
 * FinOps — provider pricing + shared-cost attribution contracts.
 *
 * These types are consumed by pure helpers in
 * `apps/api/src/modules/admin/finops-helpers.ts` (effective-date resolution,
 * shared-cost allocation). The persisted tables (`llm_model_pricing`,
 * `shared_cost_entries`) are owned by migration `048` (LLM pricing, other
 * session) and `049` (shared costs, this work).
 */

/**
 * Currency used for all cost storage. Costs are always stored in micro-units
 * (1/1,000,000 of the major unit) as BIGINT to avoid floating-point error.
 */
export const FINOPS_DEFAULT_CURRENCY = 'USD';

/**
 * A provider pricing row with effective dates. Mirrors `llm_model_pricing` but
 * is provider-agnostic so the FinOps helpers can price any usage stream. The
 * DB may store many rows per (provider, model, currency); only one may be
 * effective at any instant.
 */
export interface ProviderPricingRow {
  /** Provider key (e.g. 'openai', 'keepa', 'amazon-proxy'). */
  provider: string;
  /** Model or SKU within the provider (e.g. 'gpt-4o-mini', 'keepa-token'). */
  model: string;
  /** Cost per million units of input (micro-USD). */
  inputCostPerMillionMicros: number;
  /** Cost per million units of output (micro-USD). */
  outputCostPerMillionMicros: number;
  /** Cost per million embedding tokens (micro-USD); 0 when not applicable. */
  embeddingCostPerMillionMicros: number;
  /** ISO-8601 inclusive start of the pricing window. */
  effectiveFrom: string;
  /** ISO-8601 exclusive end; null = open-ended (current price). */
  effectiveTo: string | null;
  /** Currency code (e.g. 'USD'). */
  currency: string;
}

/**
 * Input to the shared-cost allocator. The allocator returns a per-tenant share
 * in micro-USD for each tenant in {@link tenants}.
 */
export interface SharedCostAllocationInput {
  /** Total cost to allocate (micro-USD). Must be >= 0. */
  totalCostMicros: number;
  /** Tenants that share the cost. Each has a non-negative usage weight. */
  tenants: Array<{ userId: string; usageWeight: number }>;
  /**
   * Allocation method. {@link SharedCostAllocationMethod.EVEN_SPLIT} ignores
   * usageWeight; {@link USAGE_WEIGHTED} splits proportionally; {@link MANUAL}
   * uses precomputed shares (not represented here — handled by the caller).
   */
  method: SharedCostAllocationMethod;
}

/** Result of a shared-cost allocation: one share per tenant. */
export interface SharedCostAllocationResult {
  shares: Array<{ userId: string; shareMicros: number }>;
  /** Sum of all shares — equals {@link SharedCostAllocationInput.totalCostMicros} when exact, or differs by the rounding residue. */
  allocatedTotalMicros: number;
  /** Residue that could not be evenly distributed (always < tenants.length micros). */
  residueMicros: number;
}

/** Input to the effective-date pricing resolver. */
export interface ResolvePricingInput {
  provider: string;
  model: string;
  /** ISO-8601 instant to resolve at; null = now. */
  atIso: string | null;
}

/** Resolved pricing for a (provider, model) at a point in time. */
export interface ResolvedPricing {
  /** The effective row, or null when no pricing is configured for the window. */
  row: ProviderPricingRow | null;
  /** True when a row exists and covers the instant. */
  isPriced: boolean;
}
