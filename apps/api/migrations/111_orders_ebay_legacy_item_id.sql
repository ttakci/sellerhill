-- Remember which eBay listing an order came from, even when we do not track it
-- (operator decision, 2026-09-17).
--
-- An order is matched to a listing ONLY at first ingest, by
-- `lineItem.legacyItemId` → `listings.ebay_item_id`. When no listing matched,
-- that item id was thrown away — so an order from a listing the seller later
-- imported could never be connected to it, even though the two are obviously
-- the same item. The seller saw "Unknown product" for ever, its profit stayed
-- unknown, and because eBay needs a line item to accept a shipment, tracking
-- could not be pushed for it either.
--
-- Storing the id costs one small column and changes no behaviour on its own.
-- What it enables is `OrderSyncService.adoptUntrackedOrdersForListing`, called
-- when an existing eBay listing is imported: past orders of that exact item are
-- linked to the new listing row.
--
-- IT REMAINS TRUE THAT MATCHING HAPPENS AT INGEST. Adoption links an order; it
-- never triggers an automatic purchase, because auto-fulfill fires only on a
-- genuine order INSERT. That separation is the whole reason adoption is safe:
-- importing a listing must never send months-old orders shopping on Amazon.
--
-- No backfill: orders ingested before this migration carry no item id, and
-- there is nothing to derive it from locally.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ebay_legacy_item_id VARCHAR(50);

-- The adoption lookup: untracked orders of one store's item. Partial, because
-- only rows with no listing are ever searched this way.
CREATE INDEX IF NOT EXISTS idx_orders_untracked_legacy_item
  ON orders (ebay_account_id, ebay_legacy_item_id)
  WHERE listing_id IS NULL;
