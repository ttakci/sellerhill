-- Stores the reason the last verification attempt failed (null when verified/never failed).
-- Surfaced to the owner on the connected-accounts card when status = invalid.
ALTER TABLE amazon_accounts ADD COLUMN IF NOT EXISTS last_verification_error TEXT;
