-- Amazon order-list auto cost-capture (Task 7):
-- Timestamp of the last successful "Your Orders" page scrape per account.
-- Read by AmazonOrderSyncService to fetch only orders placed since this date.
ALTER TABLE amazon_accounts
  ADD COLUMN IF NOT EXISTS last_orders_sync_at TIMESTAMP WITH TIME ZONE;
