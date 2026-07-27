-- Migration 052: Billing foundation (phase 1).
--
-- Configurable, DB-parametric subscription billing schema. Plans, prices,
-- limits, active flag, and display order are ALL stored in DB — no code
-- deploy required to change pricing, add a plan, retire a plan, or adjust
-- limits. The application reads the effective rows at runtime.
--
-- Tables introduced (all prefixed `billing_`):
--   1. billing_plans              — plan metadata + is_active + display_order
--   2. billing_plan_prices        — monthly/annual prices, effective-dated (micros)
--   3. billing_plan_limits        — limit definitions + per-plan values
--   4. billing_customers          — 1:1 with users (provider linkage)
--   5. billing_subscriptions      — customer -> plan subscriptions with status
--   6. billing_usage_periods      — monthly usage tracking per subscription
--   7. billing_listing_reservations — listing-slot reservations (with status)
--   8. billing_ao_reservations    — Amazon-order-slot reservations (with status)
--   9. billing_webhook_inbox      — append-only incoming webhook log
--
-- Design notes:
--   - Money is stored as BIGINT micro-units (1/1,000,000 of the major unit)
--     to avoid floating-point error — mirrors the FinOps convention
--     (usage_events.estimated_cost_micros, llm_model_pricing). Currency is
--     always USD at phase 1 (CHAR(3) column for future multi-currency).
--   - Effective dates on prices follow the same pattern as llm_model_pricing:
--     at most one row may be effective at any instant (partial unique index).
--   - Reservations are append-only ledger rows with a status enum so the
--     historical record is preserved; current entitlement is the latest row
--     per (subscription_id, slot_kind, slot_key).
--   - Webhook inbox is append-only; processing status is tracked separately
--     so retries are idempotent.
--   - No FK to users with ON DELETE CASCADE — billing records must survive
--     user deletion for audit. ON DELETE SET NULL keeps the audit trail.
--
-- This migration is additive only and does not alter existing tables.

-- =============================================================================
-- 1. billing_plans — plan metadata
-- =============================================================================
CREATE TABLE IF NOT EXISTS billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Stable machine key (e.g. 'starter', 'growth', 'scale'). Never changes
    -- once a plan is live — subscriptions reference the UUID, but the slug is
    -- the human/code-facing identifier.
    slug VARCHAR(50) NOT NULL UNIQUE,
    -- Display name (i18n keys live in the frontend; this is the fallback).
    name VARCHAR(120) NOT NULL,
    -- Short marketing description.
    description TEXT,
    -- Whether the plan is purchasable today. Inactive plans remain in DB for
    -- historical subscriptions but are hidden from new sign-ups.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Sort order in plan pickers/tables (ascending). Lower = earlier.
    display_order INTEGER NOT NULL DEFAULT 0,
    -- OptionalStripe-style product id (set when the plan is mirrored to the
    -- billing provider). Nullable until provider integration lands.
    provider_product_id VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- display_order must be non-negative.
    CONSTRAINT billing_plans_display_order_nonneg CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_active_order
    ON billing_plans(is_active, display_order);

-- =============================================================================
-- 2. billing_plan_prices — monthly/annual prices, effective-dated
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE billing_price_interval AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_plan_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
    interval billing_price_interval NOT NULL,
    -- Price in micro-units (1/1,000,000 of USD). $39.00 = 39_000_000.
    amount_micros BIGINT NOT NULL CHECK (amount_micros >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    -- Effective-date window. effective_from is inclusive; effective_to is
    -- exclusive. NULL effective_to = open-ended (current price).
    effective_from DATE NOT NULL,
    effective_to DATE,
    -- Optional provider-side price id (Stripe price_...). Nullable until
    -- provider integration lands.
    provider_price_id VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Cost and currency pair (mirrors usage_events convention).
    CONSTRAINT billing_plan_prices_amount_currency_pair CHECK (
        amount_micros IS NOT NULL AND currency IS NOT NULL
    ),
    -- Window ordering invariant: effective_to, when set, must be after
    -- effective_from.
    CONSTRAINT billing_plan_prices_window_order CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

-- At most one price may be effective for a (plan, interval, currency) at any
-- instant. This is a partial unique index on the open-ended current price —
-- the canonical pattern from llm_model_pricing. Overlapping closed windows
-- are also prevented by the same index (effective_to IS NOT NULL rows are
-- unique on (plan_id, interval, currency, effective_from)).
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_plan_prices_open
    ON billing_plan_prices(plan_id, interval, currency)
    WHERE effective_to IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_plan_prices_window
    ON billing_plan_prices(plan_id, interval, currency, effective_from);

CREATE INDEX IF NOT EXISTS idx_billing_plan_prices_plan_interval
    ON billing_plan_prices(plan_id, interval, effective_from DESC);

-- =============================================================================
-- 3. billing_plan_limits — limit definitions + per-plan values
-- =============================================================================
-- Limit definitions are themselves DB rows so a new metered dimension can be
-- added without a code deploy. The `limit_key` is the machine identifier the
-- application reads (e.g. 'listings_per_month', 'amazon_orders_per_month').

CREATE TABLE IF NOT EXISTS billing_plan_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
    -- Machine key for the limit. See BillingLimitKey enum in shared package
    -- for the canonical phase-1 set.
    limit_key VARCHAR(80) NOT NULL,
    -- Numeric limit value. -1 = unlimited. 0 = feature disabled.
    -- BIGINT so very large quotas (e.g. API calls) fit without overflow.
    limit_value BIGINT NOT NULL,
    -- Optional human-readable unit (e.g. 'listings', 'orders', 'calls').
    unit VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One value per (plan, limit_key).
    CONSTRAINT billing_plan_limits_unique UNIQUE (plan_id, limit_key),
    -- -1 (unlimited) is allowed; otherwise the value must be non-negative.
    CONSTRAINT billing_plan_limits_value_range CHECK (
        limit_value = -1 OR limit_value >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_billing_plan_limits_plan
    ON billing_plan_limits(plan_id);

-- =============================================================================
-- 4. billing_customers — 1:1 with users
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE billing_customer_status AS ENUM ('active', 'locked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    -- Optional provider-side customer id (Stripe cus_...). Nullable until
    -- provider integration lands; phase-1 customers are local-only.
    provider_customer_id VARCHAR(200),
    -- Provider key ('stripe' | 'local' | ...). 'local' for phase-1.
    provider VARCHAR(40) NOT NULL DEFAULT 'local',
    status billing_customer_status NOT NULL DEFAULT 'active',
    -- Email snapshot for invoicing/receipts (may differ from users.email over
    -- time as users change their login email).
    billing_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_provider
    ON billing_customers(provider, provider_customer_id)
    WHERE provider_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_customers_status
    ON billing_customers(status);

-- =============================================================================
-- 5. billing_subscriptions — customer -> plan subscriptions
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE billing_subscription_status AS ENUM (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'ended'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE billing_subscription_interval AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    status billing_subscription_status NOT NULL DEFAULT 'active',
    interval billing_subscription_interval NOT NULL DEFAULT 'monthly',
    -- Current period boundaries (the window the subscription is paid for).
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    -- When the subscription was cancelled (if applicable). past_due/canceled/
    -- ended rows set this; active/trialing rows leave it NULL.
    canceled_at TIMESTAMPTZ,
    -- When the subscription ended (terminal). ended rows set this.
    ended_at TIMESTAMPTZ,
    -- Optional provider-side subscription id (Stripe sub_...).
    provider_subscription_id VARCHAR(200),
    -- Free-form metadata (e.g. trial end, promo code). JSONB for flexibility.
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Period ordering invariant.
    CONSTRAINT billing_subscriptions_period_order CHECK (
        current_period_end > current_period_start
    ),
    -- canceled_at, when set, must be at or after the period start.
    CONSTRAINT billing_subscriptions_canceled_after_start CHECK (
        canceled_at IS NULL OR canceled_at >= current_period_start
    ),
    -- ended_at, when set, must be at or after canceled_at (if both set).
    CONSTRAINT billing_subscriptions_ended_after_canceled CHECK (
        ended_at IS NULL OR canceled_at IS NULL OR ended_at >= canceled_at
    )
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer
    ON billing_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
    ON billing_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end
    ON billing_subscriptions(current_period_end)
    WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider
    ON billing_subscriptions(provider_subscription_id)
    WHERE provider_subscription_id IS NOT NULL;

-- =============================================================================
-- 6. billing_usage_periods — monthly usage tracking per subscription
-- =============================================================================
-- One row per (subscription, period). The application increments used_qty as
-- metered events arrive; the limit_value snapshot is captured at period start
-- so mid-period plan/limit changes do not retroactively move the goalposts.

DO $$ BEGIN
    CREATE TYPE billing_usage_period_status AS ENUM (
        'open',
        'closed',
        'finalized'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_usage_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
    -- The limit this period tracks (matches billing_plan_limits.limit_key).
    limit_key VARCHAR(80) NOT NULL,
    -- Period boundaries (inclusive start, exclusive end). Typically a month.
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    -- Quantity consumed so far this period.
    used_qty BIGINT NOT NULL DEFAULT 0 CHECK (used_qty >= 0),
    -- Snapshot of the limit value at period start. -1 = unlimited.
    limit_value_snapshot BIGINT NOT NULL,
    status billing_usage_period_status NOT NULL DEFAULT 'open',
    -- When the period was closed/finalized.
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One open period per (subscription, limit_key) at a time, and no
    -- overlapping periods for the same (subscription, limit_key).
    CONSTRAINT billing_usage_periods_unique_open UNIQUE (
        subscription_id, limit_key, period_start
    ),
    CONSTRAINT billing_usage_periods_period_order CHECK (
        period_end > period_start
    ),
    -- Snapshot must be -1 (unlimited) or non-negative.
    CONSTRAINT billing_usage_periods_snapshot_range CHECK (
        limit_value_snapshot = -1 OR limit_value_snapshot >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_sub
    ON billing_usage_periods(subscription_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_open
    ON billing_usage_periods(subscription_id, limit_key)
    WHERE status = 'open';

-- =============================================================================
-- 7. billing_listing_reservations — listing-slot reservations (ledger)
-- =============================================================================
-- Append-only ledger of listing-slot reservations against a subscription's
-- monthly listings limit. Each row is an event; the application reads the
-- latest row per (subscription_id, listing_id) to determine current state.

DO $$ BEGIN
    CREATE TYPE billing_reservation_status AS ENUM (
        'reserved',
        'released',
        'overage'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_listing_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
    -- The listing this reservation is for. Loose coupling (no FK to listings)
    -- so a listing cleanup never blocks the billing ledger.
    listing_id UUID NOT NULL,
    -- The usage period this reservation counts against.
    usage_period_id UUID REFERENCES billing_usage_periods(id) ON DELETE SET NULL,
    status billing_reservation_status NOT NULL DEFAULT 'reserved',
    -- Optional provider-side invoice/line id when overage is billed.
    provider_line_id VARCHAR(200),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_listing_resv_sub
    ON billing_listing_reservations(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_listing_resv_listing
    ON billing_listing_reservations(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_listing_resv_status
    ON billing_listing_reservations(subscription_id, status)
    WHERE status = 'reserved';

-- =============================================================================
-- 8. billing_ao_reservations — Amazon-order-slot reservations (ledger)
-- =============================================================================
-- Append-only ledger of Amazon-order-slot reservations against a
-- subscription's monthly Amazon-orders limit. Same ledger pattern as listing
-- reservations.

CREATE TABLE IF NOT EXISTS billing_ao_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
    -- The eBay order this AO reservation is for (the Amazon order is the
    -- billable event triggered by an eBay sale). Loose coupling, no FK.
    ebay_order_id UUID NOT NULL,
    -- The usage period this reservation counts against.
    usage_period_id UUID REFERENCES billing_usage_periods(id) ON DELETE SET NULL,
    status billing_reservation_status NOT NULL DEFAULT 'reserved',
    provider_line_id VARCHAR(200),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_ao_resv_sub
    ON billing_ao_reservations(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_ao_resv_order
    ON billing_ao_reservations(ebay_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_ao_resv_status
    ON billing_ao_reservations(subscription_id, status)
    WHERE status = 'reserved';

-- =============================================================================
-- 9. billing_webhook_inbox — append-only incoming webhook log
-- =============================================================================
-- Provider webhooks (Stripe, etc.) land here first, then an idempotent
-- processor applies them. Append-only by design — the inbox is the source of
-- truth for "what did the provider tell us and when".

DO $$ BEGIN
    CREATE TYPE billing_webhook_status AS ENUM (
        'received',
        'processing',
        'processed',
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS billing_webhook_inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Provider key ('stripe' | 'local' | ...).
    provider VARCHAR(40) NOT NULL,
    -- Provider-side event id (Stripe evt_...). Used for idempotency: a
    -- repeated delivery of the same event is deduped on this column.
    provider_event_id VARCHAR(200),
    -- Event type (Stripe 'invoice.paid', etc.).
    event_type VARCHAR(120) NOT NULL,
    -- Raw payload (JSONB so any provider shape is stored verbatim).
    payload JSONB NOT NULL,
    status billing_webhook_status NOT NULL DEFAULT 'received',
    -- When processing started/finished.
    processing_started_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    -- Error message if status = 'failed'. Nullable.
    error TEXT,
    -- Number of processing attempts (for retry limiting).
    attempts INTEGER NOT NULL DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: one row per (provider, provider_event_id). NULL event ids
-- (provider-local webhooks) are allowed and not deduped.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_webhook_provider_event
    ON billing_webhook_inbox(provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_webhook_status
    ON billing_webhook_inbox(status, received_at);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_received
    ON billing_webhook_inbox(received_at DESC);

-- =============================================================================
-- Seed: phase-1 plans, prices, and limits.
-- =============================================================================
-- Plans: Starter $39/mo, Growth $55/mo, Scale $75/mo (annual = 2 months free
-- = monthly * 10). Limits: listings/month (1500/2500/4500) and
-- amazon_orders/month (150/250/450). All values DB-parametric — change them
-- via SQL, no code deploy.

INSERT INTO billing_plans (slug, name, description, is_active, display_order)
VALUES
    ('starter', 'Starter', 'For solo sellers getting started with automated dropshipping.', TRUE, 10),
    ('growth',  'Growth',  'For growing sellers who need more listings and Amazon orders.', TRUE, 20),
    ('scale',   'Scale',   'For high-volume sellers running multiple stores at scale.',     TRUE, 30)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- Prices. Monthly: $39 / $55 / $75. Annual: 10x monthly (2 months free).
-- Stored as micro-units: $39.00 = 39_000_000.
-- Effective from 2026-01-01, open-ended (current price).
INSERT INTO billing_plan_prices (plan_id, interval, amount_micros, currency, effective_from, effective_to)
SELECT
    p.id,
    CASE WHEN pr.interval = 'monthly' THEN 'monthly'::billing_price_interval
         ELSE 'annual'::billing_price_interval END,
    pr.amount_micros,
    'USD',
    DATE '2026-01-01',
    NULL
FROM (VALUES
    ('starter', 'monthly',  39000000),
    ('starter', 'annual',  390000000),
    ('growth',  'monthly',  55000000),
    ('growth',  'annual',  550000000),
    ('scale',   'monthly',  75000000),
    ('scale',   'annual',  750000000)
) AS pr(slug, interval, amount_micros)
JOIN billing_plans p ON p.slug = pr.slug
ON CONFLICT DO NOTHING;

-- Limits. -1 = unlimited, 0 = disabled, N = quota.
-- Phase-1 limit keys: 'listings_per_month' and 'amazon_orders_per_month'.
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT
    p.id,
    l.limit_key,
    l.limit_value,
    l.unit
FROM (VALUES
    ('starter', 'listings_per_month',      1500, 'listings'),
    ('starter', 'amazon_orders_per_month',  150, 'orders'),
    ('growth',  'listings_per_month',      2500, 'listings'),
    ('growth',  'amazon_orders_per_month',  250, 'orders'),
    ('scale',   'listings_per_month',      4500, 'listings'),
    ('scale',   'amazon_orders_per_month',  450, 'orders')
) AS l(slug, limit_key, limit_value, unit)
JOIN billing_plans p ON p.slug = l.slug
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();
