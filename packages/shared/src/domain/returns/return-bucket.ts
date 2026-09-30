// packages/shared/src/domain/returns/return-bucket.ts
//
// ONE grouping of a return, in TypeScript and in SQL. Both read only fields
// eBay documents (docs/ebay-reference/post-order/post-order_v2_return_search__get.txt):
//   - `state` / `status` = CLOSED  → the return is over
//   - `status` = ESCALATED         → "escalated to a return case"
//   - `sellerResponseDue`          → "the next action the seller is responsible
//                                     for, and the 'due date' for this action"
// Change the two together; `return-bucket.spec.ts` compares them.

import { EBAY_RETURN_CLOSED, EBAY_RETURN_STATUS_ESCALATED, ReturnBucket, ReturnTab } from './returns.types';

export interface ReturnBucketInput {
  state?: string | null;
  status?: string | null;
  sellerActivityDue?: string | null;
  sellerRespondBy?: string | Date | null;
}

/** Priority order — the first rule that matches wins. */
export function deriveReturnBucket(input: ReturnBucketInput, now: Date): ReturnBucket {
  if (input.state === EBAY_RETURN_CLOSED || input.status === EBAY_RETURN_CLOSED) {
    return ReturnBucket.CLOSED;
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
 * constants are interpolated; "now" is the database clock.
 */
export function buildReturnBucketSql(alias: string): string {
  return `CASE
    WHEN ${alias}.state = '${EBAY_RETURN_CLOSED}' THEN '${ReturnBucket.CLOSED}'
    WHEN ${alias}.status = '${EBAY_RETURN_CLOSED}' THEN '${ReturnBucket.CLOSED}'
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
  [ReturnTab.IN_PROGRESS]: [ReturnBucket.IN_PROGRESS, ReturnBucket.ESCALATED],
  [ReturnTab.CLOSED]: [ReturnBucket.CLOSED],
};
