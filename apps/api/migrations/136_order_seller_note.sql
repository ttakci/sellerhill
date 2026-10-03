-- The seller's own note on an order (operator request, 2026-10-02).
--
-- Private to the seller: nothing sends it to eBay, Amazon or the buyer, and
-- order sync never writes it (the upsert names its columns, and this one is
-- not among them). Free text may mention the buyer, so the eBay account-
-- deletion erasure clears it together with the other buyer columns.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_note TEXT;
