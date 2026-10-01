-- 133_order_timeline_and_initial_auto_status.sql
--
-- 1. `orders.delivered_at` — when the platform observed the Amazon parcel as
--    delivered (the SHIPPED/WAITING -> COMPLETED transition in the tracking
--    processor). The order detail page's step-by-step timeline shows it. It is
--    the DETECTION time (the polling tick that read "Delivered"), not the
--    carrier's own timestamp. NULL for orders completed before this migration:
--    the timeline then shows the step as done without a date, never a guess.
--
-- 2. `auto_fulfill_status` no longer starts at `pending` for every row.
--    `pending` means "a purchase job is queued" and is rendered as the stage
--    "buying on Amazon". The column default (migration 038) handed it to every
--    new order, so a sale the platform never queues — no SellerHill listing
--    behind it, or first seen long after it was placed — said "buying" for
--    ever. Order sync now writes the starting status itself
--    (`initialAutoFulfillStatus`); the default becomes `skipped` so a row no
--    code path queued a job for can never read as an in-flight purchase.
--
-- 3. Existing rows: a `pending` row with no click stamp that is either
--    untracked (a job is only ever queued for an order with a listing) or has
--    sat untouched for over an hour and is more than a day old (a queued job
--    runs within minutes; its retries finish within a few more) has no job
--    behind it. `skipped` with no reason — nothing went wrong; the seller can
--    still start the automatic order by hand on a tracked one.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE orders ALTER COLUMN auto_fulfill_status SET DEFAULT 'skipped';

UPDATE orders
   SET auto_fulfill_status = 'skipped'
 WHERE auto_fulfill_status = 'pending'
   AND auto_fulfill_submitted_at IS NULL
   AND (
     listing_id IS NULL
     OR (created_at < NOW() - INTERVAL '1 day' AND updated_at < NOW() - INTERVAL '1 hour')
   );

COMMIT;
