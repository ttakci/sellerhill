-- Draft listings are prepared locally before eBay publish — no ebay_item_id yet.
-- UNIQUE still applies to non-null values; PostgreSQL allows multiple NULLs.
ALTER TABLE listings
  ALTER COLUMN ebay_item_id DROP NOT NULL;
