// apps/api/src/modules/billing/quota-helpers.ts
//
// Pure helpers for billing quota enforcement. No DB, no Nest — fully unit
// tested by quota-helpers.spec.ts. The enforcement service composes these with
// BillingRepositoryService calls.
//
// Built ON TOP of the phase-1 billing foundation: uses the foundation's
// `resolveBillingConfig().enforcementEnabled` as the master bypass, the
// `BillingLimitKey` enum for limit dimensions, and the `BillingReservationStatus`
// enum for reservation lifecycle (reserved → released; "consume" leaves the
// row as 'reserved' since it counts for the billing period).

import {
  AutoFulfillBlockedReason,
  BillingLimitKey,
  BillingReservationStatus,
} from '@repo/shared';

import { resolveBillingConfig, type BillingConfig } from './billing-helpers';

/**
 * Map a BillingLimitKey to the reservation table + source-key prefix it uses.
 * The foundation has two reservation tables (billing_listing_reservations,
 * billing_ao_reservations); this helper is the single seam that maps a limit
 * dimension to its table + idempotency-key prefix.
 */
export interface ReservationTarget {
  table: 'billing_listing_reservations' | 'billing_ao_reservations';
  sourceKeyPrefix: 'create' | 'publish' | 'ao';
  /** The column the count query sums (always 'id' — counting reserved rows). */
  statusValue: BillingReservationStatus.RESERVED;
}

export function reservationTargetFor(
  kind: BillingLimitKey,
  mode: 'create' | 'publish' | 'ao',
): ReservationTarget {
  if (kind === BillingLimitKey.LISTINGS_PER_MONTH) {
    return {
      table: 'billing_listing_reservations',
      sourceKeyPrefix: mode === 'publish' ? 'publish' : 'create',
      statusValue: BillingReservationStatus.RESERVED,
    };
  }
  return {
    table: 'billing_ao_reservations',
    sourceKeyPrefix: 'ao',
    statusValue: BillingReservationStatus.RESERVED,
  };
}

/**
 * Build the idempotency source_key for a reservation. Stable across retries so
 * a duplicate enqueue collapses onto the same row instead of double-counting.
 *
 *   listing create : 'create:{listingJobItemId}'
 *   listing publish: 'publish:{listingId}'
 *   amazon order   : 'ao:{ebayOrderId}'
 */
export function buildSourceKey(
  kind: BillingLimitKey,
  ref: { listingJobItemId?: string; listingId?: string; ebayOrderId?: string },
): string {
  if (kind === BillingLimitKey.LISTINGS_PER_MONTH) {
    if (ref.listingId) {
      return `publish:${ref.listingId}`;
    }
    if (ref.listingJobItemId) {
      return `create:${ref.listingJobItemId}`;
    }
    throw new Error('listings_per_month reservation requires listingId or listingJobItemId');
  }
  if (kind === BillingLimitKey.AMAZON_ORDERS_PER_MONTH) {
    if (!ref.ebayOrderId) {
      throw new Error('amazon_orders_per_month reservation requires ebayOrderId');
    }
    return `ao:${ref.ebayOrderId}`;
  }
  throw new Error(`unsupported limit kind: ${String(kind)}`);
}

/**
 * Decide whether an operation may proceed given current in-use count and the
 * resolved limit. Pure: no side effects.
 *
 * Limit semantics (from the foundation): -1 = unlimited, 0 = disabled, N = quota.
 *   - unlimited → always allowed
 *   - disabled (0) → never allowed (the feature is off for this plan)
 *   - N → allowed iff in-use + requested <= N
 */
export function decideQuota(params: {
  inUse: number;
  limitValue: number;
  requested: number;
}): { allowed: boolean } {
  const { inUse, limitValue, requested } = params;
  // -1 = unlimited (foundation sentinel).
  if (limitValue === -1) {
    return { allowed: true };
  }
  const safeInUse = Math.max(0, Math.floor(inUse));
  const safeRequested = Math.max(1, Math.floor(requested));
  const safeLimit = Math.max(0, Math.floor(limitValue));
  return { allowed: safeInUse + safeRequested <= safeLimit };
}

/**
 * Whether a worker failure should release the reservation. Only PERMANENT
 * failures release — transport failures that BullMQ will retry must keep the
 * reservation held so a retry doesn't oversell.
 *
 *   active_listings create: release only on terminal ERROR (isLastAttempt).
 *     Intermediate RETRYING holds.
 *   amazon_orders: release on blocked (terminal) OR final-attempt transport
 *     failure. Intermediate transport failure holds (BullMQ retry keeps hold).
 */
export function shouldReleaseOnWorkerFailure(params: {
  kind: BillingLimitKey;
  isLastAttempt: boolean;
  /** For AO: whether the checkout blocked (terminal) vs threw (transport). */
  blocked?: boolean;
}): boolean {
  if (params.kind === BillingLimitKey.AMAZON_ORDERS_PER_MONTH) {
    return Boolean(params.blocked) || params.isLastAttempt;
  }
  return params.isLastAttempt;
}

/**
 * Map an AO quota exhaustion to the persisted `auto_fulfill_blocked_reason`
 * string. This is the ONLY place that maps quota → blocked reason, so the FE
 * chip / "needs attention" filter gets a stable enum value (never a hardcoded
 * status string — CLAUDE.md rule 10).
 */
export function quotaExhaustedBlockedReason(): AutoFulfillBlockedReason {
  return AutoFulfillBlockedReason.QUOTA_EXHAUSTED;
}

/**
 * Resolve the billing config (for the enforcement-enabled bypass). Re-exported
 * here so the enforcement service has a single import seam for config.
 */
export function getBillingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  return resolveBillingConfig(env);
}

/**
 * Whether the enforcement gates should run at all. When false, every gate is a
 * no-op (the create/publish/AO paths behave exactly as before). Delegates to
 * the foundation's `resolveBillingConfig().enforcementEnabled`.
 */
export function isEnforcementEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getBillingConfig(env).enforcementEnabled;
}

/**
 * One lock discriminator per metered dimension.
 *
 * A `Record` rather than a ternary: the original was
 * `kind === LISTINGS ? 1 : 2`, which silently gave every non-listing dimension
 * the SAME lock. With only two keys that was merely opaque; once tracking
 * conversions were added it would have made conversions and automatic orders
 * serialise against each other for no reason. An exhaustive record cannot
 * quietly absorb a third key.
 */
const LOCK_DISCRIMINATOR: Record<BillingLimitKey, number> = {
  [BillingLimitKey.LISTINGS_PER_MONTH]: 1,
  [BillingLimitKey.AMAZON_ORDERS_PER_MONTH]: 2,
  [BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH]: 3,
};

/**
 * A stable 64-bit advisory-lock key derived from (subscription_id, kind). Two
 * distinct (subscription, kind) pairs never collide; the same pair always maps
 * to the same lock so concurrent bursts for one subscription serialise.
 *
 * Used by the bulk-create + publish reserve paths so a concurrent burst cannot
 * oversell: the count+reserve happens atomically under the lock.
 */
export function advisoryLockKey(
  subscriptionId: string,
  kind: BillingLimitKey,
): { key1: number; key2: number } {
  const kindDisc = LOCK_DISCRIMINATOR[kind] ?? 0;
  // FNV-1a hash of subscription_id into a 32-bit int. Stable across processes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < subscriptionId.length; i++) {
    hash ^= subscriptionId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return { key1: kindDisc, key2: hash >>> 0 };
}

/**
 * Inclusive start / exclusive end of the UTC calendar month containing `now`.
 *
 * UTC, not the server's local time: the monthly meters must roll at the same
 * instant for every seller regardless of where the API process runs, and a
 * process restarted in a different timezone must not move the boundary and
 * hand somebody a second month's allowance.
 */
export function utcMonthBounds(now: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { periodStart, periodEnd };
}
