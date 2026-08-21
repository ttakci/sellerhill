-- =============================================================================
-- 087: buyable top-ups for the tracking-conversion quota.
--
-- WHY ONLY CONVERSIONS ARE TOPPABLE-UP
--   The three metered dimensions are not the same kind of thing, so they cannot
--   all be sold the same way:
--
--   * listings is a LEVEL, not a monthly flow. "More listings for this month"
--     is not a coherent product — a listing you add stays. Wanting more is a
--     plan upgrade, and that already exists.
--   * amazon_orders is a 2x ANTI-ABUSE CEILING (migration 085), not a priced
--     meter. Selling more of it means selling more of the Playwright pool,
--     which is the platform's scarcest physical resource and the one that
--     cannot be bought back with money. A seller who hits it should move up a
--     plan, not buy their way past the guard rail.
--   * tracking_conversions is the priced meter and has a real, linear unit
--     cost (~$0.10/shipment). Selling more of it is a straightforward margin
--     sale and costs us nothing we cannot buy more of.
--
--   So there is exactly one top-up product line, and adding a second later is
--   a row here plus a decision that it is honest to sell — never a new table.
--
-- WHY CREDITS ARE SCOPED TO ONE CALENDAR MONTH
--   The meter they raise is monthly, so a credit that outlived the month would
--   need its own consumption ledger (how much of the balance did October draw
--   down?) — a second accounting of the same thing, and the kind that drifts.
--   Raising the current month's ceiling instead is a single SUM and cannot
--   disagree with the count.
--
--   The obvious objection is buying on the 28th and losing it on the 1st. That
--   is real, and the answer is in the product rather than the schema: the
--   top-up is offered ONLY when the seller has actually reached their limit, so
--   nobody is sold an allowance they have no use for. `period_start` is stamped
--   server-side at grant time, never sent by the client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The catalog of buyable packs. Mirrors billing_plan_prices' conventions:
--    micro-USD amounts, a nullable provider_price_id filled in by
--    `pnpm --filter api stripe:sync-catalog`, and is_active for soft retirement
--    (never DELETE — a granted credit references the pack it came from).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_quota_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Stable machine key. Never changes once live.
    slug VARCHAR(80) NOT NULL UNIQUE,
    -- Which meter this raises. Matches billing_plan_limits.limit_key.
    limit_key VARCHAR(80) NOT NULL,
    -- How much allowance one purchase grants.
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    amount_micros BIGINT NOT NULL CHECK (amount_micros >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    -- Stripe price_... for a ONE-TIME price (mode: 'payment'), not a recurring
    -- one. Nullable until the sync script runs.
    provider_price_id VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_quota_addons_active
    ON billing_quota_addons(limit_key, display_order)
    WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 2. Granted credits — append-only, one row per completed purchase.
--
--    `provider_event_id` is the idempotency key and is UNIQUE: Stripe retries
--    webhook deliveries, and granting the same purchase twice is free
--    allowance. The webhook inbox already dedupes, but this is the constraint
--    that makes double-granting structurally impossible rather than merely
--    unlikely — the same belt-and-braces reasoning as
--    `buyer_message_log`'s partial unique index.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_quota_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    limit_key VARCHAR(80) NOT NULL,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    -- First instant of the UTC month this credit applies to. Stamped
    -- server-side at grant time.
    period_start TIMESTAMPTZ NOT NULL,
    -- Which pack was bought. SET NULL rather than CASCADE: a retired pack must
    -- not erase the history of what a customer paid for.
    addon_id UUID REFERENCES billing_quota_addons(id) ON DELETE SET NULL,
    -- Stripe event that granted this. The idempotency key.
    provider_event_id VARCHAR(200) NOT NULL UNIQUE,
    amount_micros BIGINT,
    currency CHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_quota_credits_lookup
    ON billing_quota_credits(user_id, limit_key, period_start);

COMMENT ON TABLE billing_quota_credits IS
    'Append-only grants of extra monthly quota. Scoped to one UTC calendar month; never deleted.';

-- -----------------------------------------------------------------------------
-- 3. Seed the conversion packs.
--
--    Priced against the ~$0.10/conversion unit cost with a volume discount, and
--    all three stay comfortably profitable after Stripe's 2.9% + $0.30:
--      100 -> $19.99  (net ~$19.11, cost $10, ~46% margin)
--      250 -> $44.99  (net ~$43.39, cost $25, ~41% margin)
--      500 -> $79.99  (net ~$77.37, cost $50, ~34% margin)
-- -----------------------------------------------------------------------------
INSERT INTO billing_quota_addons (slug, limit_key, quantity, amount_micros, display_order)
VALUES
    ('conversions-100', 'tracking_conversions_per_month', 100, 19990000, 10),
    ('conversions-250', 'tracking_conversions_per_month', 250, 44990000, 20),
    ('conversions-500', 'tracking_conversions_per_month', 500, 79990000, 30)
ON CONFLICT (slug) DO UPDATE SET
    limit_key = EXCLUDED.limit_key,
    quantity = EXCLUDED.quantity,
    amount_micros = EXCLUDED.amount_micros,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();
