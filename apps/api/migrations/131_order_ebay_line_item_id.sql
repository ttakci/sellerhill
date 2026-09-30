-- 131: orders.ebay_line_item_id — the eBay ORDER LINE ITEM id.
--
-- eBay's createShippingFulfillment names `lineItems[].lineItemId` of the
-- order ("the unique identifier of an eBay order line item"), which is NOT
-- the listing's legacy item id. The first live tracking conversion
-- (03-15243-67997, 2026-09-30) sent the listing id and eBay answered
-- 400 "Invalid line item id", so the paid converted number never reached
-- the buyer. Order sync now stores the id from the getOrders payload it
-- already downloads; an order ingested before this migration is completed
-- with one getOrder read at push time and remembered here.
--
-- Nullable, no default, no backfill: NULL = not yet read from eBay.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ebay_line_item_id VARCHAR(50);
