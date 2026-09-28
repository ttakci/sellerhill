/**
 * Run `worker` over `items` with at most `limit` in flight at once.
 *
 * Built for `ListingProcessorService.processListingBatch`, whose per-item
 * preparation (EPS image uploads, the LLM title rewrite, category + aspect
 * resolution) is independent between items but used to run strictly
 * sequentially — 20 ASINs paid 20 × the full per-item latency end to end.
 *
 * Semantics, each one load-bearing for that caller:
 * - `shouldStop` is consulted before each START. Once it returns true, no new
 *   item begins, but items already in flight always run to completion — an
 *   in-flight item may already have spent an eBay call, and abandoning it
 *   mid-way is how phantom state gets written.
 * - A rejection from `worker` likewise stops new starts, lets everything
 *   in flight settle, then rethrows the FIRST error. The batch caller wraps
 *   each item in its own try/catch, so a rejection reaching here is a
 *   programming error — propagating it (after draining) hands it to BullMQ's
 *   retry exactly as the old sequential loop did.
 * - A non-finite or sub-1 `limit` degrades to sequential (1), never to zero
 *   workers: a bad env value must slow the batch down, not hang it.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldStop?: () => boolean
): Promise<void> {
  const runners = Math.min(
    items.length,
    Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1
  );

  let nextIndex = 0;
  let firstError: unknown;
  let failed = false;

  const runner = async (): Promise<void> => {
    for (;;) {
      if (failed || shouldStop?.()) {
        return;
      }
      const index = nextIndex;
      if (index >= items.length) {
        return;
      }
      nextIndex += 1;
      try {
        await worker(items[index], index);
      } catch (error: unknown) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: runners }, () => runner()));

  if (failed) {
    throw firstError;
  }
}
