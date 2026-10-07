-- apps/api/migrations/146_listing_revisions_source_price.sql
-- The Revisions drawer's "Price" row is the listing's eBay SALE price, and a
-- seller could not see the Amazon price that moved it. Each revision row now
-- also records the Amazon (source) price the product carried at that check,
-- plus what the previous row recorded, so the drawer can print
-- "Amazon price 13.69 → 14.10" beside "eBay sale price 17.64 → 18.57".
--
-- Same shape as migration 134 (Amazon stock): `previous_source_price` is read
-- from the listing's latest earlier revision at insert time, by both writers
-- in ProductSyncService. Rows written before this migration keep NULLs.

ALTER TABLE listing_revisions
    ADD COLUMN IF NOT EXISTS previous_source_price NUMERIC(10, 2) NULL,
    ADD COLUMN IF NOT EXISTS new_source_price NUMERIC(10, 2) NULL;
