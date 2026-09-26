-- Amazon stock as the scraper provider observes it (spec 2026-09-26-amazon-scraper-provider).
--
-- stock_status: 'exact' | 'at_least' | 'out_of_stock'. 'unknown' is never
--   stored — it means "keep the previous row". Existing rows hold Keepa's
--   exact numbers, hence the default.
-- max_order_quantity: the Buy Box quantity-dropdown maximum (the seller's
--   per-order limit, or Amazon's default 30). NULL = unknown; always NULL
--   for Keepa-sourced rows.
-- source_removed_at: set when the product page returns 404; cleared when it
--   returns. Feeds the Action Center "unavailable on Amazon" item.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(16) NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS max_order_quantity INT NULL,
  ADD COLUMN IF NOT EXISTS source_removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_products_source_removed
  ON products (source_removed_at)
  WHERE source_removed_at IS NOT NULL;
