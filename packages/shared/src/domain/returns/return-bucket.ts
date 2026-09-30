// packages/shared/src/domain/returns/return-bucket.ts
//
// ONE grouping of a return, in TypeScript and in SQL. Both read only fields
// eBay documents (docs/ebay-reference/post-order/post-order_v2_return_search__get.txt):
//   - `state` / `status` = CLOSED  → the return is over
//   - `status` = ESCALATED         → "escalated to a return case"
//   - `sellerResponseDue`          → "the next action the seller is responsible
//                                     for, and the 'due date' for this action"
//
// Plus one rule that is ours, not eBay's: FRESHNESS. A row is only as true as
// the last sweep that saw it. A return that dropped out of the search response
// (older than the search window, beyond the first page, a store whose token
// broke, the sweep switched off) keeps whatever it last said for ever — and
// "eBay is waiting for you, deadline passed" is not something to keep claiming
// on stale data. An open row eBay has not confirmed recently is UNCONFIRMED.
//
// Change the two together; `return-bucket.spec.ts` compares them.

import { EBAY_RETURN_CLOSED, EBAY_RETURN_STATUS_ESCALATED, ReturnBucket, ReturnTab } from './returns.types';

export interface ReturnBucketInput {
  state?: string | null;
  status?: string | null;
  sellerActivityDue?: string | null;
  sellerRespondBy?: string | Date | null;
  /** `ebay_returns.last_synced_at` — when eBay last reported this return. Omitted = not checked. */
  lastSyncedAt?: string | Date | null;
}

/** A row is never called stale sooner than this, however short the sweep interval. */
export const RETURN_FRESHNESS_MIN_HOURS = 24;

const MAX_FRESHNESS_HOURS = 24 * 365;

/**
 * How long a row stays trusted after eBay last reported it: two sweep
 * intervals (one missed sweep is not evidence of anything), and never less
 * than a day. Derived from `ebay.returnSync.intervalHours` so lengthening the
 * interval in the admin panel cannot turn every return stale between sweeps.
 */
export function resolveReturnFreshnessHours(sweepIntervalHours: number | null | undefined): number {
  const interval =
    typeof sweepIntervalHours === 'number' && Number.isFinite(sweepIntervalHours) && sweepIntervalHours > 0
      ? sweepIntervalHours
      : 0;
  return Math.min(Math.max(RETURN_FRESHNESS_MIN_HOURS, Math.ceil(interval * 2)), MAX_FRESHNESS_HOURS);
}

function assertFreshnessHours(hours: number): number {
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_FRESHNESS_HOURS) {
    throw new Error(`Return freshness must be a whole number of hours between 1 and ${MAX_FRESHNESS_HOURS}`);
  }
  return hours;
}

/** Priority order — the first rule that matches wins. */
export function deriveReturnBucket(
  input: ReturnBucketInput,
  now: Date,
  freshnessHours: number = RETURN_FRESHNESS_MIN_HOURS
): ReturnBucket {
  // Closed is final: a closed return needs no further confirmation.
  if (input.state === EBAY_RETURN_CLOSED || input.status === EBAY_RETURN_CLOSED) {
    return ReturnBucket.CLOSED;
  }
  if (input.lastSyncedAt) {
    const seen = new Date(input.lastSyncedAt).getTime();
    if (Number.isFinite(seen) && seen < now.getTime() - assertFreshnessHours(freshnessHours) * 3_600_000) {
      return ReturnBucket.UNCONFIRMED;
    }
  }
  if (input.status === EBAY_RETURN_STATUS_ESCALATED) {
    return ReturnBucket.ESCALATED;
  }
  if (input.sellerActivityDue) {
    const deadline = input.sellerRespondBy ? new Date(input.sellerRespondBy).getTime() : null;
    if (deadline !== null && Number.isFinite(deadline) && deadline < now.getTime()) {
      return ReturnBucket.ACTION_OVERDUE;
    }
    return ReturnBucket.ACTION_DUE;
  }
  return ReturnBucket.IN_PROGRESS;
}

/**
 * SQL twin of `deriveReturnBucket` over an `ebay_returns` row alias. Only enum
 * constants and the validated whole-hour freshness are interpolated; "now" is
 * the database clock.
 */
export function buildReturnBucketSql(alias: string, freshnessHours: number = RETURN_FRESHNESS_MIN_HOURS): string {
  const hours = assertFreshnessHours(freshnessHours);
  return `CASE
    WHEN ${alias}.state = '${EBAY_RETURN_CLOSED}' THEN '${ReturnBucket.CLOSED}'
    WHEN ${alias}.status = '${EBAY_RETURN_CLOSED}' THEN '${ReturnBucket.CLOSED}'
    WHEN ${alias}.last_synced_at < NOW() - INTERVAL '${hours} hours' THEN '${ReturnBucket.UNCONFIRMED}'
    WHEN ${alias}.status = '${EBAY_RETURN_STATUS_ESCALATED}' THEN '${ReturnBucket.ESCALATED}'
    WHEN ${alias}.seller_activity_due IS NOT NULL AND ${alias}.seller_respond_by IS NOT NULL AND ${alias}.seller_respond_by < NOW() THEN '${ReturnBucket.ACTION_OVERDUE}'
    WHEN ${alias}.seller_activity_due IS NOT NULL THEN '${ReturnBucket.ACTION_DUE}'
    ELSE '${ReturnBucket.IN_PROGRESS}'
  END`;
}

/** Buckets where the seller has to do something. */
export const ACTIONABLE_RETURN_BUCKETS: readonly ReturnBucket[] = [ReturnBucket.ACTION_OVERDUE, ReturnBucket.ACTION_DUE];

export const RETURN_TABS: Readonly<Record<ReturnTab, readonly ReturnBucket[]>> = {
  [ReturnTab.ALL]: Object.values(ReturnBucket),
  [ReturnTab.ACTION]: ACTIONABLE_RETURN_BUCKETS,
  [ReturnTab.IN_PROGRESS]: [ReturnBucket.IN_PROGRESS, ReturnBucket.ESCALATED, ReturnBucket.UNCONFIRMED],
  [ReturnTab.CLOSED]: [ReturnBucket.CLOSED],
};
