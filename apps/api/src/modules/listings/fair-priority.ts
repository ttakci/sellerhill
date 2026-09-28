/** BullMQ priorities run 1 (highest) .. 2^21. */
export const BULLMQ_MAX_PRIORITY = 2_097_152;

/**
 * Per-seller fairness on the shared listings queue: a chunk's priority is the
 * number of chunks the same seller already has waiting, plus its own position.
 * One seller's 20th chunk therefore runs after another seller's first, so a
 * 500-ASIN upload cannot hold a 5-ASIN upload behind it.
 */
export function fairBatchPriority(queuedItemsForUser: number, chunkIndex: number, chunkSize = 25): number {
  const queuedChunks = Math.ceil(Math.max(0, queuedItemsForUser) / chunkSize);
  return Math.min(1 + queuedChunks + Math.max(0, chunkIndex), BULLMQ_MAX_PRIORITY);
}
