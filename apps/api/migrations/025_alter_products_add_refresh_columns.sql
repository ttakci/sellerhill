-- Stale-driven Keepa refresh pipeline support.
-- The scheduler selects products WHERE next_refresh_at <= NOW(); the worker
-- updates last_refresh_attempt_at / last_successful_refresh_at and reschedules.
-- consecutive_failures drives poison-product quarantine to avoid queue starvation.
ALTER TABLE products ADD COLUMN IF NOT EXISTS next_refresh_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_refresh_attempt_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_successful_refresh_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_next_refresh_at ON products(next_refresh_at ASC);

-- Backfill existing products: stagger due times across one refresh interval so the
-- first scheduler ticks don't thundering-herd the whole catalog. RANDOM() spreads
-- next_refresh_at uniformly over the next 12h (default interval).
UPDATE products
SET next_refresh_at = NOW() + (RANDOM() * INTERVAL '12 hours')
WHERE next_refresh_at IS NULL;
