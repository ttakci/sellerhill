-- 056: Amazon-side cancellation signal (A2 tracking hardening).
--
-- When the Amazon tracker observes the linked AMAZON purchase as cancelled,
-- the local eBay order status is deliberately NOT changed: the eBay sale is
-- still live and must be fulfilled another way. Instead this timestamp is
-- stamped and the order is surfaced through the "needs attention" filter
-- (together with auto_fulfill_status blocked/failed).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amazon_cancelled_at TIMESTAMPTZ NULL;

-- Partial index keeps the needs-attention filter cheap (the column is NULL
-- for virtually every row).
CREATE INDEX IF NOT EXISTS idx_orders_amazon_cancelled
  ON orders (user_id)
  WHERE amazon_cancelled_at IS NOT NULL;
