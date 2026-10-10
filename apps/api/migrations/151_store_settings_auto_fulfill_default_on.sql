-- Automatic orders are ON by default for a store-settings row (operator
-- decision, 2026-10-10). This is the STORE master toggle only; an automatic
-- purchase still needs a buyer account with auto-fulfill enabled AND a spend
-- cap (`amazon_accounts.auto_fulfill_enabled` + `auto_fulfill_cap_total`,
-- migration 037), which stays off by default.
--
-- Existing rows are NOT changed: a seller who saved "off" keeps "off".
ALTER TABLE store_settings ALTER COLUMN auto_fulfill_enabled SET DEFAULT TRUE;
