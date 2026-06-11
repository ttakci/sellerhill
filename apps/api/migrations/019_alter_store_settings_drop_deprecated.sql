-- Drop deprecated columns from store_settings
ALTER TABLE store_settings DROP COLUMN IF EXISTS address;
ALTER TABLE store_settings DROP COLUMN IF EXISTS price_limit;
