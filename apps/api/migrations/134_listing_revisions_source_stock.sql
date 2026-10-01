-- apps/api/migrations/134_listing_revisions_source_stock.sql
-- The Revisions drawer showed only the eBay quantity (what the quantity
-- formula sent to eBay), and a seller reading "Stock 1 → 1, unchanged" could
-- not tell whether Amazon's stock had moved underneath it. Each revision row
-- now also records the AMAZON stock the product carried at that check —
-- the value and its status (exact / at least / out of stock / unknown), so
-- "20+" renders as "20+" — plus what the previous row recorded, so the drawer
-- can print "Amazon stock 24 → 19" beside "eBay stock 5 → 5".
--
-- `previous_*` is read from the listing's latest earlier revision at insert
-- time (both writers in ProductSyncService), not threaded through the
-- refresh pipeline: the row before this one IS the last observation.
-- Rows written before this migration keep NULLs; the drawer shows the new
-- value alone for them.

ALTER TABLE listing_revisions
    ADD COLUMN IF NOT EXISTS previous_source_stock INT NULL,
    ADD COLUMN IF NOT EXISTS previous_source_stock_status VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS new_source_stock INT NULL,
    ADD COLUMN IF NOT EXISTS new_source_stock_status VARCHAR(16) NULL;
