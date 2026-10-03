-- =============================================================================
-- 137: a thirteenth paid plan, `mini`, below Lite (operator decision, 2026-10-02).
--
--      $19.99 / month · 100 active listings · 20 tracking conversions / month
--      · 1,000 Best Sellers products / month · unlimited automatic orders.
--
-- Worst-case margin, same model as 125 (the seller spends the WHOLE conversion
-- quota at Aquiline's $0.14, Stripe 2.9% + $0.30, ~$1 infrastructure + proxy
-- share): 20 x 0.14 = $2.80, Stripe $0.88, infrastructure $1.00 -> $4.68 of
-- cost against $19.99, i.e. ~77%, level with Lite (78%). 20 conversions is
-- the trial's own figure, so the plan is never smaller than the trial it
-- converts from.
--
-- Every statement is an upsert on the table's own natural key, so a re-run
-- changes nothing. `provider_product_id` / `provider_price_id` stay NULL: the
-- hourly catalog sync inside `PriceMigrationProcessor` mints the Stripe Product
-- and Price (no operator command), and checkout answers
-- `billing.errors.planNotMirrored` for this plan until it has.
--
-- display_order 5 puts it ahead of Lite (10) in every catalog listing.
-- =============================================================================

INSERT INTO billing_plans (slug, name, description, is_active, display_order)
VALUES
    ('mini', 'Mini', 'For sellers taking their first steps with a hundred listings.', TRUE, 5)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- The NOT EXISTS keeps a re-run from touching an open row that already carries
-- a Stripe Price id; the ON CONFLICT covers two API replicas booting at once.
INSERT INTO billing_plan_prices (plan_id, interval, amount_micros, currency, effective_from, effective_to)
SELECT p.id, 'monthly'::billing_price_interval, 19990000::BIGINT, 'USD', CURRENT_DATE, NULL
FROM billing_plans p
WHERE p.slug = 'mini'
  AND NOT EXISTS (
      SELECT 1 FROM billing_plan_prices x
       WHERE x.plan_id = p.id
         AND x.interval = 'monthly'::billing_price_interval
         AND x.currency = 'USD'
         AND x.effective_to IS NULL
  )
ON CONFLICT (plan_id, interval, currency) WHERE effective_to IS NULL
DO UPDATE SET
    amount_micros = EXCLUDED.amount_micros,
    effective_from = EXCLUDED.effective_from,
    updated_at = NOW();

-- All four limit keys are written explicitly: an ABSENT row resolves to
-- unlimited, which for tracking conversions would mean unlimited paid
-- conversions (the 085 §1b lesson).
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, v.limit_key, v.limit_value, v.unit
FROM (VALUES
    ('listings_per_month',               100::BIGINT, 'listings'),
    ('tracking_conversions_per_month',    20,         'conversions'),
    ('best_sellers_products_per_month', 1000,         'products'),
    ('amazon_orders_per_month',           -1,         'orders')
) AS v(limit_key, limit_value, unit)
JOIN billing_plans p ON p.slug = 'mini'
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();
