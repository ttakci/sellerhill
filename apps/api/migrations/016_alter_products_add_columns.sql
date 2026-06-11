-- Add columns for existing databases where products was created without these
ALTER TABLE products ADD COLUMN IF NOT EXISTS raw_provider_data JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS raw_keepa_data JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_repriced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0;
