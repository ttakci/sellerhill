-- =============================================================================
-- 086: per-seller tracking-conversion scope + manual-order conversion switch.
--
-- WHY SCOPE IS A SETTING AND NOT A RULE
--   `tracking-conversion.service.ts` deliberately converted EVERY carrier and
--   its own comment said why a TB* gate must not be hardcoded: converting only
--   Amazon Logistics hides the supplier on some orders and exposes it on the
--   rest, and that is a trade-off only the seller can make. The same comment
--   named the correct home for the choice — "it belongs in store settings as an
--   explicit seller choice". This is that column.
--
--   Default is amazon_logistics_only rather than all, because 'all' is now the
--   expensive option: conversions are the metered dimension (migration 085), a
--   TB* number is the loudest supplier tell, and a native UPS/USPS scan is
--   stronger evidence than a third-party carrier in an eBay Item-Not-Received
--   case. A seller who wants maximum concealment opts up.
--
--   NOTE this changes behaviour for existing rows: a seller already on the
--   Aquiline provider converts only TB* numbers after this migration. That is
--   intended — it lowers their cost and ours — and it is visible/reversible in
--   one click in Store Settings.
--
-- WHY MANUAL ORDERS GET THEIR OWN SWITCH
--   Default TRUE: a seller who places every order by hand would otherwise have
--   to remember a per-order button, and forgetting it exposes the supplier —
--   the exact failure conversion exists to prevent. It is a switch rather than
--   unconditional because linking a backlog should not silently spend a month
--   of quota; bulk historical linking is exempt in code regardless.
-- =============================================================================

ALTER TABLE store_settings
    ADD COLUMN IF NOT EXISTS tracking_conversion_scope VARCHAR(32) NOT NULL
        DEFAULT 'amazon_logistics_only',
    ADD COLUMN IF NOT EXISTS tracking_convert_manual_orders BOOLEAN NOT NULL
        DEFAULT TRUE;

-- Mirrors TrackingConversionScope in @repo/shared. A CHECK rather than a PG
-- enum to match how tracking_conversion_provider is already stored (VARCHAR),
-- so adding a third scope later stays a one-line migration.
ALTER TABLE store_settings
    DROP CONSTRAINT IF EXISTS store_settings_tracking_conversion_scope_check;

ALTER TABLE store_settings
    ADD CONSTRAINT store_settings_tracking_conversion_scope_check
    CHECK (tracking_conversion_scope IN ('all', 'amazon_logistics_only'));

COMMENT ON COLUMN store_settings.tracking_conversion_scope IS
    'Which carriers the conversion provider applies to: all | amazon_logistics_only (default).';
COMMENT ON COLUMN store_settings.tracking_convert_manual_orders IS
    'Convert tracking for orders the seller linked by hand, not just auto-fulfilled ones.';
