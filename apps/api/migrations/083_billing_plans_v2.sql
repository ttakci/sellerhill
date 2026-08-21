-- 083_billing_plans_v2.sql
--
-- Replaces the placeholder 3-plan catalog (starter/growth/scale, seeded by
-- migration 052) with a costed 12-tier ladder, and tightens the trial.
--
-- MONTHLY ONLY. The annual interval seeded by 052 is closed out here: annual
-- billing was modelled and is profitable, but was dropped as a deliberate
-- simplification (one price per plan, no interval toggle, 12 Stripe Prices
-- instead of 24). Reintroducing it later is a new migration inserting `annual`
-- rows — the schema already supports it and `BillingInterval.ANNUAL` stays in
-- the code.
--
-- Prices come from a full cost model, not from matching a competitor. The
-- drivers, by weight: Aquiline tracking conversion (~$0.10/shipment), Keepa
-- refresh tokens (~$0.010-0.015 per active product per month at scale), Stripe
-- fees, listing churn (negligible — a create is 8 tokens once, a refresh is 8
-- tokens 60x a month), and infrastructure. Every tier is verified profitable
-- from ~5 users onward AND for a single user who fills their quota (worst-case
-- margin 14%; normal-usage margin 56-75%).
--
-- The AO (automatic order) quota tapers from 12.5% of listings at the entry
-- tier to 3.2% at the top. That is both realistic sell-through for a large
-- catalogue and what the Aquiline unit cost allows: matching Easync's flat 10%
-- at the top tiers puts a fully-utilised user above what they pay. Overage is
-- an add-on sale (~$20 per 100 extra AO against a ~$10 cost), not a loss.
--
-- Effective-date discipline: prices are never edited in place. Superseded rows
-- get `effective_to = CURRENT_DATE` so historical subscriptions keep the price
-- that applied when they were created; the new price is a new row with
-- `effective_to = NULL` (the open-ended current price, enforced unique per
-- (plan, interval, currency) by uq_billing_plan_prices_open).
--
-- provider_product_id / provider_price_id stay NULL here. They are populated
-- by `pnpm --filter api stripe:sync-catalog`, which creates the Stripe
-- Products/Prices and writes their ids back. Checkout throws
-- 'billing.errors.planNotMirrored' until that runs.

-- =============================================================================
-- 1. Close every currently-open price. Both intervals: the annual rows are
--    retired outright, the monthly rows are superseded by the new ladder below.
-- =============================================================================
UPDATE billing_plan_prices
SET effective_to = CURRENT_DATE,
    updated_at = NOW()
WHERE effective_to IS NULL
  AND effective_from < CURRENT_DATE;

-- A price created earlier today would violate the window-order CHECK
-- (effective_to > effective_from), so same-day rows are removed rather than
-- closed. Safe: no subscription references a price row directly — they
-- reference the plan — and this only fires when 083 runs on the same day the
-- catalog was seeded (a fresh install).
DELETE FROM billing_plan_prices
WHERE effective_to IS NULL
  AND effective_from >= CURRENT_DATE;

-- =============================================================================
-- 2. Retire `scale`. Not deleted: is_active = FALSE hides it from the picker
--    (`loadCatalog` filters on it) while any subscription still pointing at it
--    keeps resolving. Nothing references it today — enforcement has never been
--    enabled and no checkout has run — but deleting a catalog row is never the
--    right move when deactivating achieves the same result.
-- =============================================================================
UPDATE billing_plans
SET is_active = FALSE,
    updated_at = NOW()
WHERE slug = 'scale';

-- =============================================================================
-- 3. Upsert the 12-tier ladder.
--    `starter` and `growth` already exist (052) and are updated in place, so
--    their ids — and any subscription pointing at them — survive. The other ten
--    are new. `trial` (migration 069) is handled separately in section 6.
-- =============================================================================
INSERT INTO billing_plans (slug, name, description, is_active, display_order)
VALUES
    ('lite',       'Lite',       'For sellers just getting started with a small catalog.',          TRUE,  10),
    ('nano',       'Nano',       'For testing the waters with a focused product set.',              TRUE,  20),
    ('micro',      'Micro',      'For solo sellers running a compact catalog.',                     TRUE,  30),
    ('starter',    'Starter',    'For sellers with a growing catalog and steady order flow.',       TRUE,  40),
    ('basic',      'Basic',      'For established sellers scaling past a few thousand listings.',   TRUE,  50),
    ('plus',       'Plus',       'For sellers running a broad catalog across multiple niches.',     TRUE,  60),
    ('growth',     'Growth',     'For high-volume sellers with a five-thousand-listing catalog.',   TRUE,  70),
    ('advanced',   'Advanced',   'For power sellers managing a large, actively repriced catalog.',  TRUE,  80),
    ('pro',        'Pro',        'For professional operations running ten thousand listings.',      TRUE,  90),
    ('elite',      'Elite',      'For large operations with a fifteen-thousand-listing catalog.',   TRUE, 100),
    ('business',   'Business',   'For multi-store businesses at twenty thousand listings.',         TRUE, 110),
    ('enterprise', 'Enterprise', 'For the largest catalogs, with priority support.',                TRUE, 120)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- =============================================================================
-- 4. Monthly prices. Micro-units: $19.99 = 19_990_000.
-- =============================================================================
INSERT INTO billing_plan_prices (plan_id, interval, amount_micros, currency, effective_from, effective_to)
SELECT p.id, 'monthly'::billing_price_interval, v.amount_micros, 'USD', CURRENT_DATE, NULL
FROM (VALUES
    ('lite',        19990000::BIGINT),
    ('nano',        24990000),
    ('micro',       29990000),
    ('starter',     44990000),
    ('basic',       59990000),
    ('plus',        84990000),
    ('growth',     104990000),
    ('advanced',   159990000),
    ('pro',        179990000),
    ('elite',      319990000),
    ('business',   429990000),
    ('enterprise', 529990000)
) AS v(slug, amount_micros)
JOIN billing_plans p ON p.slug = v.slug
ON CONFLICT (plan_id, interval, currency) WHERE effective_to IS NULL
DO UPDATE SET
    amount_micros = EXCLUDED.amount_micros,
    effective_from = EXCLUDED.effective_from,
    updated_at = NOW();

-- =============================================================================
-- 5. Limits: active listings and monthly automatic orders.
--    Keys mirror BillingLimitKey in @repo/shared.
-- =============================================================================
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, v.limit_key, v.limit_value, v.unit
FROM (VALUES
    ('lite',       'listings_per_month',         200::BIGINT, 'listings'),
    ('lite',       'amazon_orders_per_month',     25,         'orders'),
    ('nano',       'listings_per_month',         500,         'listings'),
    ('nano',       'amazon_orders_per_month',     50,         'orders'),
    ('micro',      'listings_per_month',        1000,         'listings'),
    ('micro',      'amazon_orders_per_month',    100,         'orders'),
    ('starter',    'listings_per_month',        2000,         'listings'),
    ('starter',    'amazon_orders_per_month',    150,         'orders'),
    ('basic',      'listings_per_month',        3000,         'listings'),
    ('basic',      'amazon_orders_per_month',    200,         'orders'),
    ('plus',       'listings_per_month',        4000,         'listings'),
    ('plus',       'amazon_orders_per_month',    250,         'orders'),
    ('growth',     'listings_per_month',        5000,         'listings'),
    ('growth',     'amazon_orders_per_month',    300,         'orders'),
    ('advanced',   'listings_per_month',        7500,         'listings'),
    ('advanced',   'amazon_orders_per_month',    350,         'orders'),
    ('pro',        'listings_per_month',       10000,         'listings'),
    ('pro',        'amazon_orders_per_month',    500,         'orders'),
    ('elite',      'listings_per_month',       15000,         'listings'),
    ('elite',      'amazon_orders_per_month',    600,         'orders'),
    ('business',   'listings_per_month',       20000,         'listings'),
    ('business',   'amazon_orders_per_month',    700,         'orders'),
    ('enterprise', 'listings_per_month',       25000,         'listings'),
    ('enterprise', 'amazon_orders_per_month',    800,         'orders')
) AS v(slug, limit_key, limit_value, unit)
JOIN billing_plans p ON p.slug = v.slug
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();

-- =============================================================================
-- 6. Tighten the trial (migration 069 seeded it at 1,000 listings / 100 AO).
--    A trial exists to prove the product works, not to run a business on: at
--    1,000 listings it was larger than the Micro plan it is meant to convert
--    into, so there was no reason to upgrade before it expired. 50 listings /
--    10 AO is enough to list, sell, and see a real captured cost — the whole
--    point — and costs ~$0.65 per trial in Keepa + Aquiline.
--    The plan stays is_active = FALSE: it is granted programmatically, never
--    purchasable from the picker.
-- =============================================================================
UPDATE billing_plan_limits
SET limit_value = CASE limit_key
        WHEN 'listings_per_month' THEN 50
        WHEN 'amazon_orders_per_month' THEN 10
        ELSE limit_value
    END,
    updated_at = NOW()
WHERE plan_id = (SELECT id FROM billing_plans WHERE slug = 'trial')
  AND limit_key IN ('listings_per_month', 'amazon_orders_per_month');
