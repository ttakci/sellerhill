-- =============================================================================
-- 085: move the priced meter from automatic orders to tracking conversions.
--
-- WHY
--   The per-unit cash cost of an order is the Aquiline tracking conversion
--   (~$0.10/shipment), not the order itself. Once a seller can choose to
--   convert only Amazon Logistics (TB*) numbers — added in migration 086 — the
--   order count stops predicting our cost at all: 300 orders with 100 TB*
--   numbers costs the same as 100 orders.
--
--   So `tracking_conversions_per_month` becomes the metered, priced dimension
--   and takes over the numbers `amazon_orders_per_month` used to carry.
--
-- WHY amazon_orders_per_month IS KEPT (at 2x) RATHER THAN REMOVED
--   Orders are not free to us even when unconverted — they are the opposite of
--   free on the resource that actually runs out. Every order consumes the
--   platform-wide Playwright pool (AMAZON_GLOBAL_CONCURRENCY, 5 concurrent =>
--   ~13M browser-seconds/month), and an UNCONVERTED order costs MORE of it
--   than a converted one: a converted shipment stops Amazon polling because
--   delivery arrives by provider webhook, while an unconverted one keeps being
--   scraped until it is delivered (~450s vs ~330s).
--
--   That inverts the incentive: "convert only TB*" saves the seller quota and
--   costs us more browser time. The AO ceiling is therefore an ANTI-ABUSE cap,
--   not a capacity guarantee — at 2x the conversion quota it is roughly 12x the
--   sustainable per-user average, wide enough that no honest seller meets it,
--   tight enough that one account cannot drain the pool. Real protection comes
--   from monitoring; the lever is AMAZON_GLOBAL_CONCURRENCY.
--
--   Keeping the key (rather than dropping it) means re-tightening later is a
--   data change, not a schema change.
--
-- Prices are NOT touched: the Aquiline cash exposure is still capped by the
-- conversion quota at exactly the numbers the 12-tier cost model was built on,
-- so every tier's margin is unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Conversion quota — inherits the numbers AO used to carry.
-- -----------------------------------------------------------------------------
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, 'tracking_conversions_per_month', v.limit_value, 'conversions'
FROM (VALUES
    ('lite',        25::BIGINT),
    ('nano',        50),
    ('micro',      100),
    ('starter',    150),
    ('basic',      200),
    ('plus',       250),
    ('growth',     300),
    ('advanced',   350),
    ('pro',        500),
    ('elite',      600),
    ('business',   700),
    ('enterprise', 800)
) AS v(slug, limit_value)
JOIN billing_plans p ON p.slug = v.slug
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 1b. Retired plans that predate the conversion meter (migration 052's catalog).
--     They keep their own AO number, so their conversion quota is derived at the
--     same 1:2 shape. Nobody can subscribe to an inactive plan, but an existing
--     subscription pointing at one must not resolve to "no limit row" — a
--     missing limit means UNLIMITED, and unlimited conversions is the one
--     failure direction that costs real money.
-- -----------------------------------------------------------------------------
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, 'tracking_conversions_per_month', 225, 'conversions'
FROM billing_plans p
WHERE p.slug = 'scale'
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 2. Trial: 10 conversions, 20 orders — same 1:2 shape as the paid tiers.
--    Migration 083 set the trial to 50 listings / 10 AO; the 10 becomes the
--    conversion quota and AO doubles to 20, so the trial exercises the same
--    mechanics a paid plan does.
-- -----------------------------------------------------------------------------
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, 'tracking_conversions_per_month', 10, 'conversions'
FROM billing_plans p
WHERE p.slug = 'trial'
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 3. AO ceiling — 2x the conversion quota.
--
--    Derived from the conversion row rather than written as `limit_value * 2`.
--    An in-place multiply is NOT idempotent: migrations are re-applied on every
--    boot until the runner records them, and a partially-applied or manually
--    replayed run would silently produce a 4x ceiling with nothing to show it
--    had happened. Deriving makes a re-run land on the same number.
-- -----------------------------------------------------------------------------
UPDATE billing_plan_limits ao
SET limit_value = conv.limit_value * 2,
    updated_at = NOW()
FROM billing_plan_limits conv
WHERE ao.limit_key = 'amazon_orders_per_month'
  AND conv.plan_id = ao.plan_id
  AND conv.limit_key = 'tracking_conversions_per_month'
  AND ao.limit_value IS DISTINCT FROM conv.limit_value * 2;
