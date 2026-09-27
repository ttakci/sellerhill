import { SourceFetchOutcome } from '@repo/shared';

import type { CreateFetchResult } from './product-source.service';

/**
 * Maps every given ASIN to `{ kind: 'unavailable', outcome: BLOCKED }`.
 *
 * Used by `ListingProcessorService.processListingBatch` when the batch
 * prefetch call to the scraper service itself fails (network/transport, a
 * hung service, etc.). Without this, the failed call used to be swallowed
 * into `prefetched = undefined`, which left every uncached item in the batch
 * to retry `fetchForCreate` on its own, one at a time, INSIDE
 * `resolveProductData`'s per-ASIN advisory-lock transaction — a hung or
 * unreachable scraper service meant each of those retries could take up to
 * the client's own request timeout, so a 25-item batch could hold a pg client
 * open for a very long time (25 × the client timeout, worst case). Building
 * this map up front instead fails every uncached item immediately, through
 * `resolveProductData`'s existing `unavailable` branch (retryable
 * `PRODUCT_DATA_UNAVAILABLE`), with no further network calls.
 *
 * Pure and total — never throws, never inspects the failure that triggered
 * it (the caller logs that separately, and must never log the raw error body,
 * which can carry proxy endpoints/credentials).
 */
export function buildUnavailablePrefetchMap(asins: string[]): Map<string, CreateFetchResult> {
  return new Map(
    asins.map((asin): [string, CreateFetchResult] => [
      asin,
      { kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED },
    ])
  );
}
