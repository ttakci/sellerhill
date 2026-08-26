-- 089_aquiline_integration.sql
--
-- The Aquiline Integration API replaces the v3 partner API the previous client
-- targeted. See docs/superpowers/specs/2026-08-23-aquiline-integration-api-design.md.

BEGIN;

-- Profile identity. (user, marketplace) rather than per Amazon account, because
-- profiles are a paid, plan-limited resource that CANNOT be deleted
-- (/v1/profiles/{id} has only GET and PATCH), and amazon_accounts.id churns
-- when a seller removes and re-adds a buyer account.
--
-- Deliberately NO foreign key to users, the same reasoning as ebay_trial_ledger:
-- the remote profile keeps consuming a plan slot whether or not the SellerHill
-- account still exists, so the row that accounts for it must outlive a cascade.
CREATE TABLE IF NOT EXISTS aquiline_profiles (
    user_id     UUID         NOT NULL,
    marketplace VARCHAR(20)  NOT NULL DEFAULT 'AMAZON_US',
    profile_id  VARCHAR(128) NOT NULL,
    fingerprint VARCHAR(64),
    synced_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, marketplace)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aquiline_profiles_profile_id
    ON aquiline_profiles (profile_id);

-- Ship-from / return address sent as the profile's storeAddress. country/state/
-- zip_code already exist on store_settings; street, city, name and phone do not.
ALTER TABLE store_settings
    ADD COLUMN IF NOT EXISTS ship_from_name          VARCHAR(120),
    ADD COLUMN IF NOT EXISTS ship_from_phone         VARCHAR(40),
    ADD COLUMN IF NOT EXISTS ship_from_address_line1 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ship_from_address_line2 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ship_from_city          VARCHAR(120);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS aquiline_order_synced_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_html_uploaded_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_problem_code        VARCHAR(64),
    -- Start of the deferral window: the first time we observed SHIPPED.
    ADD COLUMN IF NOT EXISTS shipped_detected_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_conversion_attempts INT NOT NULL DEFAULT 0,
    -- What eBay actually received. eBay's Fulfillment API has no update
    -- endpoint, so once this is set the buyer's number can never be corrected
    -- and a later conversion would be spend with no visible effect.
    ADD COLUMN IF NOT EXISTS ebay_tracking_pushed_number  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ebay_tracking_pushed_at      TIMESTAMPTZ;

-- Provider plan counters, mirroring keepa_balance. profiles_used is recorded
-- because profiles are as metered as shipments and, unlike shipments, never
-- reset. Note the provider's window is the SUBSCRIPTION period, not a month.
CREATE TABLE IF NOT EXISTS aquiline_plan_snapshot (
    id             BIGSERIAL PRIMARY KEY,
    plan_code      VARCHAR(40),
    window_key     VARCHAR(32),
    plan_limit     INT,
    plan_used      INT,
    plan_remaining INT,
    profiles_used  INT,
    captured_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aquiline_plan_snapshot_captured
    ON aquiline_plan_snapshot (captured_at DESC);

COMMIT;
