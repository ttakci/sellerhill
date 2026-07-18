ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tracking_conversion_provider VARCHAR(20) NOT NULL DEFAULT 'local';
