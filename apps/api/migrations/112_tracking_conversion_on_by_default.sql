-- Tracking conversion is ON by default (operator decision, 2026-09-18).
--
-- `tracking_conversion_provider` has defaulted to 'local' since migration 036,
-- which means a seller who never opened Store Settings shipped every order with
-- the RAW Amazon tracking number on the eBay order — the supplier in front of
-- the buyer. The code treats that as a deliberate seller choice
-- (`PASSTHROUGH_NOT_REQUIRED`, which is publishable) and it is the one path
-- where the raw number legitimately reaches eBay. But a new seller has not
-- chosen anything; they are simply on the default. Concealing the supplier is
-- the product, so the default now converts and opting OUT is the explicit act.
--
-- What does NOT change:
--   * `tracking_conversion_scope` stays 'amazon_logistics_only'. A TB* number is
--     the loudest supplier tell; a native UPS/USPS scan reveals nothing and is
--     stronger evidence in an Item-Not-Received case. Converting it anyway
--     would spend the seller's metered (and our paid) conversion quota for no
--     concealment. Sellers who want everything converted switch it to 'all'.
--   * Turning conversion off remains possible in Store Settings. The default is
--     a default, not a lock.
--
-- EXISTING ROWS ARE BACKFILLED, and that is a real behaviour change for them:
-- their shipments start being converted, which costs conversion quota. It is
-- done deliberately, pre-launch, because leaving early rows exposed while every
-- later seller is protected is the worse outcome. It is reversible in one click
-- per store.
--
-- OPERATIONAL PRECONDITION: with conversion expected, a shipment that cannot be
-- converted is HELD — `mayPushToEbay` refuses `PASSTHROUGH_FAILED`, so eBay is
-- never told the order shipped. That is the point (never expose the supplier),
-- but it means AQUILINE_API_KEY must actually reach the API before real orders
-- ship, or every one of them is held and surfaces in the Action Center as a
-- CRITICAL "tracking held" item.

ALTER TABLE store_settings
  ALTER COLUMN tracking_conversion_provider SET DEFAULT 'aquiline';

UPDATE store_settings
   SET tracking_conversion_provider = 'aquiline',
       updated_at = NOW()
 WHERE tracking_conversion_provider = 'local'
    OR tracking_conversion_provider IS NULL;
