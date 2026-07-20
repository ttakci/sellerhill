/**
 * Single source of truth for the `auto-fulfill` BullMQ queue name.
 *
 * The producer (`AutoFulfillQueueService`) lives in `OrdersModule` (where the
 * `upsertOrder` genuine-insert hook fires); the consumer (`AutoFulfillProcessor`)
 * lives in `AmazonModule` (co-located with the checkout/rate-limit/browser
 * stack it depends on). Both connect to the SAME Redis queue by this literal —
 * BullMQ workers need no `registerQueue` on the consumer side. Keeping the
 * queue registered in `OrdersModule` avoids a circular module dep (AmazonModule
 * already imports OrdersModule for `recomputeProfit`).
 *
 * Hoisting the constant to one file (imported by both modules) prevents a
 * silent consumer detach if one side's literal were renamed without the other
 * (worker would connect to a non-existent queue → no jobs processed, no error).
 */
export const AUTO_FULFILL_QUEUE = 'auto-fulfill';

/**
 * Per-job `jobId` prefix for the producer's dedup. One fulfillment attempt per
 * eBay order across BullMQ retries — the I-4 double-order guard (paired with
 * `shouldSkipFulfillStart` in the checkout).
 */
export const AUTO_FULFILL_JOB_ID_PREFIX = 'fulfill-';
