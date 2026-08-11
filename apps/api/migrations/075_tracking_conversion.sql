-- 075_tracking_conversion.sql
--
-- External tracking-number conversion (Aquiline): persist the converted number
-- and the provider's shipment handle, and give the webhook receiver a key to
-- find the order by.
--
-- WHY THE COLUMNS ARE REQUIRED, NOT A NICETY
-- ------------------------------------------
-- Until now the converted number was recomputed on every push and never
-- stored, which was safe only because `LocalTrackingConverter` is a pure
-- function of the Amazon number. An external converter breaks that in two
-- ways at once:
--
--   1. It is BILLED per conversion ("Aquiline shipments" are the scarce half of
--      every plan tier), and
--   2. `AmazonTrackingProcessorService.handleShipped` deliberately rethrows on
--      an eBay push failure so the next scheduler tick retries the push.
--
-- Together those mean an unstored conversion would mint a NEW paid tracking
-- number on every retry and hand eBay a DIFFERENT number each time — the buyer
-- ends up with a tracking number that tracks nothing. Storing the result makes
-- the retry idempotent: the converter returns the stored number instead of
-- calling the provider again.

BEGIN;

-- The number and carrier actually sent to eBay. Distinct from
-- `amazon_tracking_number`/`amazon_tracking_carrier`, which stay as the source
-- record: we still need the Amazon number to reconcile with the supplier, and
-- overwriting it would destroy that link.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS converted_tracking_number  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS converted_tracking_carrier VARCHAR(64),
  -- Provider-side handle (Aquiline `shipmentId`). Needed for retrieval and
  -- cancellation, and it is the receipt for a resource we have paid for.
  ADD COLUMN IF NOT EXISTS tracking_provider_shipment_id VARCHAR(128),
  -- Which converter produced the row above, so a later provider switch can
  -- tell old rows apart instead of guessing from the number's shape.
  ADD COLUMN IF NOT EXISTS tracking_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS tracking_converted_at TIMESTAMPTZ;

-- The webhook arrives keyed ONLY on the tracking number, so this index is the
-- lookup path for every inbound delivery event. UNIQUE because a provider
-- tracking number identifies exactly one shipment: if a bug ever attached the
-- same number to two orders we want the write to fail loudly rather than have
-- one buyer's delivery event silently complete another buyer's order.
-- Partial, so the (many) rows with no conversion do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_converted_tracking_number
  ON orders (converted_tracking_number)
  WHERE converted_tracking_number IS NOT NULL;

-- Per-seller provider profile. Aquiline meters "seller profiles" per plan tier
-- (10 / 25 / 50 / 100 / 250), so a profile is a scarce, plan-bound resource
-- that has to be assigned deliberately rather than minted per user. NULL means
-- "use the account-level default", which is the correct behaviour while the
-- mapping is one-to-many.
--
-- It lives on store_settings because that is where the provider choice already
-- lives (`tracking_conversion_provider`) and it inherits the same
-- Store > Global > Default resolution.
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS tracking_provider_profile_id VARCHAR(128);

-- Append-only webhook inbox. Same shape and reasoning as the Paddle billing
-- inbox: the provider retries on any non-2xx (1s/5s/20s), so the same delivery
-- event WILL arrive more than once, and applying it twice would re-enqueue
-- buyer messages the buyer already received.
CREATE TABLE IF NOT EXISTS tracking_webhook_events (
  id              BIGSERIAL PRIMARY KEY,
  provider        VARCHAR(32)  NOT NULL,
  event_type      VARCHAR(64)  NOT NULL,
  tracking_number VARCHAR(64)  NOT NULL,
  -- Provider's own event timestamp; used for stale-event rejection so a
  -- long-delayed retry cannot move an order backwards.
  occurred_at     TIMESTAMPTZ  NOT NULL,
  status          VARCHAR(64),
  change_type     VARCHAR(32),
  -- 'applied' | 'duplicate' | 'stale' | 'unmatched' | 'ignored' | 'failed'
  outcome         VARCHAR(24)  NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  error           VARCHAR(500),
  received_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Idempotency key: one APPLIED row per (tracking number, event type,
-- occurrence). Partial on 'applied' so retries and unmatched deliveries are
-- still recorded for support without blocking the guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_webhook_applied
  ON tracking_webhook_events (provider, tracking_number, event_type, occurred_at)
  WHERE outcome = 'applied';

-- Support lookup: "what did we receive for this number?"
CREATE INDEX IF NOT EXISTS idx_tracking_webhook_number
  ON tracking_webhook_events (tracking_number, received_at DESC);

COMMIT;
