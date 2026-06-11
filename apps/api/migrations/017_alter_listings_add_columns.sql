-- Add columns for existing databases where listings was created without these
ALTER TABLE listings ADD COLUMN IF NOT EXISTS payment_policy_id VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_policy_id VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS return_policy_id VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS estimated_profit DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS roi DECIMAL(10,2);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS watch_count INT DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ebay_category_name TEXT;
