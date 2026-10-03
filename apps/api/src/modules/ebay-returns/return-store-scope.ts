// apps/api/src/modules/ebay-returns/return-store-scope.ts
//
// The ONE store-scope rule for seller-facing return reads, shared by the
// Returns page (`EbayReturnsService`) and the Action Center's return item.

import { ACTIONABLE_RETURN_BUCKETS, buildReturnBucketSql, EbayAccountStatus, ReturnBucket } from '@repo/shared';

const SQL_ALIAS = /^[a-z_][a-z0-9_]*$/;

/**
 * The return's eBay store is still ACTIVE. Over an `ebay_returns` row alias.
 *
 * A disconnected (or revoked) store is no longer swept and has no token, so
 * nothing about its returns can be confirmed or acted on from here. Its rows
 * stay VISIBLE on the Returns page, but an action bucket reads as UNCONFIRMED
 * — on the page, in its counts and in the Action Center alike, because all
 * three use `buildStoreScopedReturnBucketSql`.
 */
export function buildReturnStoreActiveSql(alias: string): string {
  if (!SQL_ALIAS.test(alias)) {
    throw new Error(`Unsafe SQL alias: ${alias}`);
  }
  return `EXISTS (SELECT 1 FROM ebay_accounts ret_store WHERE ret_store.id = ${alias}.ebay_account_id AND ret_store.status = '${EbayAccountStatus.ACTIVE}')`;
}

/** The ONE bucket expression for seller-facing reads: the shared bucket, store-scoped. */
export function buildStoreScopedReturnBucketSql(alias: string, freshnessHours: number): string {
  const bucket = buildReturnBucketSql(alias, freshnessHours);
  const actionable = ACTIONABLE_RETURN_BUCKETS.map((b) => `'${b}'`).join(', ');
  return `CASE WHEN (${bucket}) IN (${actionable}) AND NOT ${buildReturnStoreActiveSql(alias)} THEN '${ReturnBucket.UNCONFIRMED}' ELSE (${bucket}) END`;
}

/** TypeScript twin of the store scope in `buildStoreScopedReturnBucketSql`. */
export function scopeReturnBucketToStore(bucket: ReturnBucket, storeActive: boolean | null | undefined): ReturnBucket {
  return storeActive !== true && ACTIONABLE_RETURN_BUCKETS.includes(bucket) ? ReturnBucket.UNCONFIRMED : bucket;
}
