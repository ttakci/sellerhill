// packages/shared/src/domain/cancellations/cancellation-bucket.ts
//
// ONE grouping of a cancellation request, in TypeScript and in SQL — the same
// idea as `return-bucket.ts`, and enum-free on purpose: `CancelStateEnum` and
// `CancelStatusEnum` have no page in the local reference, so only documented
// fields decide (docs/ebay-reference/post-order/post-order_v2_cancellation_search__get.txt):
//   - `cancelCloseDate`       → "returned if/when the cancellation request is closed (regardless of outcome)"
//   - `requestorType` BUYER   → the buyer opened it (`PartyEnum`)
//   - `sellerResponseDueDate` → "the time by which the seller is required to respond …
//                                not returned if the order cancellation request does not
//                                currently require a response from the seller"
// plus FRESHNESS (ours): an open row no sweep has confirmed within the horizon
// is UNCONFIRMED, never "answer now". The horizon is the returns' one
// (`resolveReturnFreshnessHours`) fed with the cancellation sweep's interval.
//
// Change the two together; `cancellation-bucket.spec.ts` compares them.

import { RETURN_FRESHNESS_MIN_HOURS } from '../returns/return-bucket';

import {
  CancellationBucket,
  CancellationTab,
  EBAY_CANCEL_REQUESTOR_BUYER,
  EBAY_CANCEL_STATE_CLOSED,
} from './cancellations.types';

export interface CancellationBucketInput {
  state?: string | null;
  requestorType?: string | null;
  sellerRespondBy?: string | Date | null;
  closedAt?: string | Date | null;
  /** `ebay_cancellations.last_synced_at`. Omitted = not checked. */
  lastSyncedAt?: string | Date | null;
}

const MAX_FRESHNESS_HOURS = 24 * 365;

function assertFreshnessHours(hours: number): number {
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_FRESHNESS_HOURS) {
    throw new Error(`Cancellation freshness must be a whole number of hours between 1 and ${MAX_FRESHNESS_HOURS}`);
  }
  return hours;
}

/** Priority order — the first rule that matches wins. */
export function deriveCancellationBucket(
  input: CancellationBucketInput,
  now: Date,
  freshnessHours: number = RETURN_FRESHNESS_MIN_HOURS
): CancellationBucket {
  if (input.closedAt || input.state === EBAY_CANCEL_STATE_CLOSED) {
    return CancellationBucket.CLOSED;
  }
  if (input.lastSyncedAt) {
    const seen = new Date(input.lastSyncedAt).getTime();
    if (Number.isFinite(seen) && seen < now.getTime() - assertFreshnessHours(freshnessHours) * 3_600_000) {
      return CancellationBucket.UNCONFIRMED;
    }
  }
  if (input.requestorType === EBAY_CANCEL_REQUESTOR_BUYER && input.sellerRespondBy) {
    const deadline = new Date(input.sellerRespondBy).getTime();
    return Number.isFinite(deadline) && deadline < now.getTime()
      ? CancellationBucket.ACTION_OVERDUE
      : CancellationBucket.ACTION_DUE;
  }
  return CancellationBucket.IN_PROGRESS;
}

/**
 * SQL twin of `deriveCancellationBucket` over an `ebay_cancellations` row
 * alias. Only constants and the validated whole-hour horizon are interpolated.
 */
export function buildCancellationBucketSql(
  alias: string,
  freshnessHours: number = RETURN_FRESHNESS_MIN_HOURS
): string {
  const hours = assertFreshnessHours(freshnessHours);
  return `CASE
    WHEN ${alias}.closed_at IS NOT NULL THEN '${CancellationBucket.CLOSED}'
    WHEN ${alias}.state = '${EBAY_CANCEL_STATE_CLOSED}' THEN '${CancellationBucket.CLOSED}'
    WHEN ${alias}.last_synced_at < NOW() - INTERVAL '${hours} hours' THEN '${CancellationBucket.UNCONFIRMED}'
    WHEN ${alias}.requestor_type = '${EBAY_CANCEL_REQUESTOR_BUYER}' AND ${alias}.seller_respond_by IS NOT NULL AND ${alias}.seller_respond_by < NOW() THEN '${CancellationBucket.ACTION_OVERDUE}'
    WHEN ${alias}.requestor_type = '${EBAY_CANCEL_REQUESTOR_BUYER}' AND ${alias}.seller_respond_by IS NOT NULL THEN '${CancellationBucket.ACTION_DUE}'
    ELSE '${CancellationBucket.IN_PROGRESS}'
  END`;
}

/** Buckets where the seller has to answer. */
export const ACTIONABLE_CANCELLATION_BUCKETS: readonly CancellationBucket[] = [
  CancellationBucket.ACTION_OVERDUE,
  CancellationBucket.ACTION_DUE,
];

/** The buckets each cancellations-page tab shows — the `RETURN_TABS` shape. */
export const CANCELLATION_TABS: Readonly<Record<CancellationTab, readonly CancellationBucket[]>> = {
  [CancellationTab.ALL]: Object.values(CancellationBucket),
  [CancellationTab.ACTION]: ACTIONABLE_CANCELLATION_BUCKETS,
  [CancellationTab.IN_PROGRESS]: [CancellationBucket.IN_PROGRESS, CancellationBucket.UNCONFIRMED],
  [CancellationTab.CLOSED]: [CancellationBucket.CLOSED],
};
