-- Migration 035: Add amazon_tax_rate column to store_settings
-- Per-user-global (and per-store) default Amazon tax rate (percent, 0–100) used to
-- estimate provisional order profit when the real Amazon tax is unknown.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS amazon_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
