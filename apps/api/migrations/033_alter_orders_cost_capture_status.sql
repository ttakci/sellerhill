-- net_profit: NULL = unknown, 0 = computed real zero. Drop default so inserts must be explicit.
ALTER TABLE orders ALTER COLUMN net_profit DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN net_profit DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN purchase_price DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN amazon_tax DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN amazon_shipping DROP DEFAULT;

-- Confidence/state of Amazon cost capture
CREATE TYPE order_cost_capture_status AS ENUM
  ('pending', 'linked', 'provisional', 'failed', 'untracked');

ALTER TABLE orders
  ADD COLUMN cost_capture_status order_cost_capture_status NOT NULL DEFAULT 'pending';

-- Backfill from current data (order matters)
UPDATE orders SET cost_capture_status = 'linked'
  WHERE amazon_linked_at IS NOT NULL;
UPDATE orders SET cost_capture_status = 'untracked'
  WHERE listing_id IS NULL AND cost_capture_status = 'pending';
UPDATE orders SET cost_capture_status = 'provisional'
  WHERE listing_id IS NOT NULL AND amazon_linked_at IS NULL
    AND cost_capture_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_cost_capture_status ON orders(cost_capture_status);
