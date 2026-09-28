import { ListingJobQueuedSummary, resolveListingJobQueuedSummary } from '@repo/shared';

describe('resolveListingJobQueuedSummary', () => {
  it('reports ALL_QUEUED when nothing was skipped as a duplicate', () => {
    expect(resolveListingJobQueuedSummary(10, 0)).toBe(ListingJobQueuedSummary.ALL_QUEUED);
  });

  it('reports QUEUED_WITH_SKIPPED_DUPLICATES when some ASINs were already listed', () => {
    expect(resolveListingJobQueuedSummary(5, 3)).toBe(ListingJobQueuedSummary.QUEUED_WITH_SKIPPED_DUPLICATES);
  });

  it('reports ALL_SKIPPED_DUPLICATES when every ASIN submitted was already listed', () => {
    // Nothing was queued — the job record exists (0 items, COMPLETED) but the
    // seller must be told nothing new happened, not "0 ürün sıraya alındı".
    expect(resolveListingJobQueuedSummary(0, 5)).toBe(ListingJobQueuedSummary.ALL_SKIPPED_DUPLICATES);
  });

  it('reports ALL_QUEUED for the degenerate 0/0 case rather than a false duplicate claim', () => {
    expect(resolveListingJobQueuedSummary(0, 0)).toBe(ListingJobQueuedSummary.ALL_QUEUED);
  });
});
