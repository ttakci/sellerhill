-- apps/api/migrations/067_listings_sku_offer_id.sql
-- Persists the two eBay Inventory-API identifiers a listing row never stored,
-- which is the precondition for batching price/quantity pushes.
--
-- Until now `updatePriceAndStock` spent its FIRST of four HTTP calls on
-- `GET /sell/inventory/v1/offer?sku=` purely to recover the offer id, because
-- it was thrown away at create time (see the "we don't store offerId" comment
-- it replaces in ebay.service.ts). The SKU had the same problem from the other
-- direction: it was re-derived as `${asin}-NEW` at every call site instead of
-- being read back, which is silently wrong in sandbox where createListingWithRest
-- mints `${asin}-NEW-${timestamp}`.
--
-- eBay's bulkUpdatePriceQuantity addresses offers by id and inventory items by
-- SKU in a single entry, so both must be known locally before 25 listings can
-- share one call.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_offer_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_listings_ebay_offer_id
  ON listings(ebay_offer_id) WHERE ebay_offer_id IS NOT NULL;

-- The fan-out groups pending pushes by (eBay account, marketplace) because a
-- bulk call carries exactly one seller token.
CREATE INDEX IF NOT EXISTS idx_listings_account_active
  ON listings(ebay_account_id, status) WHERE status = 'ACTIVE';

-- Backfill the SKU only where the derivation is provably the one that was used
-- at create time. `${asin}-NEW` is the production branch of ebay.service.ts and
-- is exactly what the fan-out has been sending, so writing it down changes no
-- behavior — it only stops the value being recomputed.
--
-- Sandbox rows are deliberately left NULL: their SKU carries a creation
-- timestamp that cannot be reconstructed. Those listings fall back to the
-- offer-lookup path, which also self-heals the column on first success.
UPDATE listings
SET sku = asin || '-NEW'
WHERE sku IS NULL AND ebay_item_id IS NOT NULL;

-- `ebay_offer_id` is intentionally NOT backfilled. It cannot be derived, only
-- fetched, and doing 1M offer lookups inside a migration would burn the very
-- API budget this change exists to protect. The lookup remains as a per-listing
-- fallback and populates the column the first time a listing is pushed.
