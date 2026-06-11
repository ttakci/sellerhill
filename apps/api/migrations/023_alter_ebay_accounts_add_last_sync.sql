-- Add last_ebay_sync_at column to track when orders were last synced from eBay
ALTER TABLE ebay_accounts
ADD COLUMN IF NOT EXISTS last_ebay_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN ebay_accounts.last_ebay_sync_at IS 'Timestamp of the last successful order sync from eBay';
