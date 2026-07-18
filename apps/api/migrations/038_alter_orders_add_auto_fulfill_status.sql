CREATE TYPE auto_fulfill_status AS ENUM
  ('pending','running','placed','blocked','failed','dry_run','skipped');

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auto_fulfill_status auto_fulfill_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auto_fulfill_blocked_reason VARCHAR(200),
  ADD COLUMN IF NOT EXISTS auto_fulfill_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_auto_fulfill_status
  ON orders(auto_fulfill_status) WHERE auto_fulfill_status IN ('blocked','failed');
