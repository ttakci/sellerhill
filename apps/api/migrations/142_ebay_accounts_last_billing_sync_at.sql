-- Watermark + claim stamp for the billing-activity capture sweep (spec Part C3,
-- capture-only). NULL sorts first, so a store that just granted sell.finances
-- is swept on the next tick.
ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_billing_sync_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_last_billing_sync_at
  ON ebay_accounts (last_billing_sync_at NULLS FIRST)
  WHERE status = 'active';
