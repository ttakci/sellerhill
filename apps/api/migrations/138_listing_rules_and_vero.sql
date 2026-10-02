-- Listing rules, the platform VeRO list and the out-of-stock clock (2026-10-02).
--
-- 1. store_settings.listing_rules — what a seller refuses to list, decided
--    before anything is sent to eBay: VeRO protection on/off, blocked ASINs,
--    an Amazon price range, "shipped by Amazon only", rating / review
--    minimums, and the clean-up rules for listings that stay out of stock or
--    do not sell. One JSONB so a new rule is a field, not a column; NULL means
--    "defaults" (and, on a store row, "inherit the global row").
--
-- 2. vero_keywords — brand names the PLATFORM refuses to list for every
--    seller who keeps VeRO protection on. Entered by the operator in the admin
--    console and never shown to sellers: a seller sees only the on/off switch
--    and, on a refused product, the one brand that matched.
--
-- 3. listings.quantity_zero_since — when the listing's quantity last dropped
--    to 0. Kept by a trigger, not by the writers: four code paths write
--    `listings.quantity` (create, refresh fan-out, quantity-only fan-out,
--    stock sync) and a clock one of them forgot would silently never start.

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS listing_rules JSONB;

CREATE TABLE IF NOT EXISTS vero_keywords (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword    TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One entry per brand whatever its casing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vero_keywords_keyword_lower
  ON vero_keywords (LOWER(keyword));

ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity_zero_since TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION listings_track_quantity_zero() RETURNS trigger AS $$
BEGIN
  IF NEW.quantity IS NOT NULL AND NEW.quantity <= 0 THEN
    IF TG_OP = 'INSERT' OR OLD.quantity IS NULL OR OLD.quantity > 0 OR NEW.quantity_zero_since IS NULL THEN
      NEW.quantity_zero_since := COALESCE(NEW.quantity_zero_since, CURRENT_TIMESTAMP);
    END IF;
  ELSE
    NEW.quantity_zero_since := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_listings_track_quantity_zero ON listings;
CREATE TRIGGER trg_listings_track_quantity_zero
  BEFORE INSERT OR UPDATE OF quantity ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_track_quantity_zero();

-- Listings already at 0 start their clock now: how long they have really been
-- out of stock is not recorded anywhere, and guessing early would end them on
-- the first sweep.
UPDATE listings SET quantity_zero_since = CURRENT_TIMESTAMP
 WHERE quantity <= 0 AND quantity_zero_since IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_quantity_zero_since
  ON listings (quantity_zero_since)
  WHERE quantity_zero_since IS NOT NULL;

-- 4. Why the platform ended a listing on its own (the clean-up rules above):
--    'out_of_stock' | 'not_selling'. NULL on every listing the seller ended or
--    eBay reported gone, so the seller can tell an automatic ending from their
--    own.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS auto_ended_reason VARCHAR(20);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS auto_ended_at TIMESTAMPTZ;
-- An automatic ending eBay refused. The sweep leaves such a listing alone for
-- a day, so a handful that can never be ended cannot hold the head of every
-- hourly run.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS auto_end_failed_at TIMESTAMPTZ;

-- 5. A bulk add spread over time ("N a day between these hours"): when its
--    last group is due to start. NULL on every job that runs at once. The
--    groups themselves are delayed BullMQ jobs; this is only what the jobs
--    page shows, and what keeps a seller's scheduled backlog from counting
--    against the fair-priority of their next immediate upload.
ALTER TABLE listing_jobs ADD COLUMN IF NOT EXISTS scheduled_until TIMESTAMPTZ;

-- 6. Promoted Listings (general strategy). The store's campaign id on eBay —
--    one SellerHill campaign per store, created on first use — and the ad rate
--    a listing was promoted at (NULL = not promoted through SellerHill).
ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS promoted_campaign_id TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS promoted_ad_rate NUMERIC(4,1);
