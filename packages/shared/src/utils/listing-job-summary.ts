/**
 * Which success message the "Add Listings" drawer shows after `createJob`.
 *
 * `createJob` silently drops any ASIN already ACTIVE or DRAFT for the user
 * before the job record is even written — the seller pasted 20 ASINs, 5 were
 * already theirs, and the job (and every screen reading it) only ever knew
 * about the other 15. The seller saw "15 ürün sıraya alındı" with nothing
 * explaining the missing 5, and if EVERY pasted ASIN was already theirs the
 * message read "0 ürün sıraya alındı" — false: nothing was queued at all.
 */
export enum ListingJobQueuedSummary {
  ALL_QUEUED = 'all_queued',
  QUEUED_WITH_SKIPPED_DUPLICATES = 'queued_with_skipped_duplicates',
  ALL_SKIPPED_DUPLICATES = 'all_skipped_duplicates',
}

export function resolveListingJobQueuedSummary(
  queuedCount: number,
  skippedDuplicateCount: number
): ListingJobQueuedSummary {
  if (skippedDuplicateCount <= 0) {
    return ListingJobQueuedSummary.ALL_QUEUED;
  }
  return queuedCount > 0
    ? ListingJobQueuedSummary.QUEUED_WITH_SKIPPED_DUPLICATES
    : ListingJobQueuedSummary.ALL_SKIPPED_DUPLICATES;
}
