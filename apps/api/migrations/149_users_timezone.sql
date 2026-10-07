-- The seller's own calendar day for the dashboard and the daily summary e-mail.
-- IANA name validated against pg_timezone_names by the API; NULL = UTC.
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT NULL;
COMMENT ON COLUMN users.timezone IS 'IANA time zone (pg_timezone_names). NULL = UTC.';
