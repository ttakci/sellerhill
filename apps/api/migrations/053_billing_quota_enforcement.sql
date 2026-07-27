-- Migration 053: Billing quota enforcement readiness.
--
-- Phase-2 adjustment to the phase-1 billing foundation (migration 052). The
-- foundation introduced billing_listing_reservations + billing_ao_reservations
-- as append-only ledgers, but two gaps prevent the enforcement gate from using
-- them directly:
--
--   1. billing_ao_reservations.ebay_order_id is UUID, but orders.ebay_order_id
--      is VARCHAR(50) (eBay order ids are strings like '12-34567-89012'). This
--      is a type mismatch that makes inserting a real eBay order id fail. Fix:
--      alter to VARCHAR(50) to match orders.ebay_order_id.
--
--   2. billing_listing_reservations.listing_id is NOT NULL, but the create-
--      path gate reserves a slot BEFORE the listing row exists (the worker
--      creates the listing later). Fix: make listing_id nullable; the
--      source_key carries the stable idempotency key (listing_job_item_id for
--      create, listing_id for publish) so a re-reserve collapses onto the
--      existing row.
--
--   3. No idempotency key on the reservation tables. Re-enqueue (BullMQ retry,
--      order-sync re-tick) would insert duplicate reserved rows and double-
--      count. Fix: add source_key VARCHAR(200) + UNIQUE(subscription_id,
--      source_key) to both tables so a duplicate reserve is a no-op.
--
-- This migration is additive/alter-only and does not change the foundation's
-- ledger semantics (reserved → released/overage). The enforcement gate uses:
--   reserve  → INSERT ... ON CONFLICT (subscription_id, source_key) DO NOTHING
--   consume  → leave as 'reserved' (counts for the billing period)
--   release  → UPDATE latest row → 'released' (no longer counts)
--
-- No data migration needed — the tables are empty in phase 1.

-- =============================================================================
-- 1. Fix billing_ao_reservations.ebay_order_id type (UUID → VARCHAR(50))
-- =============================================================================
ALTER TABLE billing_ao_reservations
  ALTER COLUMN ebay_order_id TYPE VARCHAR(50) USING ebay_order_id::text;

-- =============================================================================
-- 2. Make billing_listing_reservations.listing_id nullable (create-path reserves
--    before the listing row exists)
-- =============================================================================
ALTER TABLE billing_listing_reservations
  ALTER COLUMN listing_id DROP NOT NULL;

-- =============================================================================
-- 3. Add source_key + idempotency unique constraint to both reservation tables
-- =============================================================================
-- source_key is the stable idempotency key:
--   listing create : 'create:{listingJobItemId}'
--   listing publish: 'publish:{listingId}'
--   amazon order   : 'ao:{ebayOrderId}'
-- UNIQUE(subscription_id, source_key) means a duplicate reserve for the same
-- subscription + key is a no-op (ON CONFLICT DO NOTHING) — BullMQ retries and
-- order-sync re-enqueues never double-count.

ALTER TABLE billing_listing_reservations
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(200);

ALTER TABLE billing_ao_reservations
  ADD COLUMN IF NOT EXISTS source_key VARCHAR(200);

-- Backfill source_key for any existing rows (none expected in phase 1, but
-- defensive): listing reservations use the listing_id, AO reservations use the
-- ebay_order_id.
UPDATE billing_listing_reservations
  SET source_key = 'publish:' || listing_id::text
  WHERE source_key IS NULL AND listing_id IS NOT NULL;

UPDATE billing_ao_reservations
  SET source_key = 'ao:' || ebay_order_id
  WHERE source_key IS NULL;

-- Now enforce non-null + uniqueness. source_key is required for all new rows
-- (the enforcement service always sets it).
ALTER TABLE billing_listing_reservations
  ALTER COLUMN source_key SET NOT NULL,
  ADD CONSTRAINT billing_listing_resv_sub_source_unique
    UNIQUE (subscription_id, source_key);

ALTER TABLE billing_ao_reservations
  ALTER COLUMN source_key SET NOT NULL,
  ADD CONSTRAINT billing_ao_resv_sub_source_unique
    UNIQUE (subscription_id, source_key);
