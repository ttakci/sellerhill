/**
 * BullMQ job name for a chunk of ASINs created through eBay's bulk endpoints.
 *
 * Shared between the producer (`ListingQueueService`) and the worker
 * (`ListingProcessorService`) so the two cannot disagree on the discriminator —
 * a typo would leave the batch silently unprocessed in the queue.
 */
export const LISTING_BATCH_JOB = 'create-listing-batch';
