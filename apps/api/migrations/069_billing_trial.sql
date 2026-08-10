-- Migration 069: automatic seven-day, cardless trial for new customers.
--
-- The plan catalog remains the only plan/limit model: trial is an inactive,
-- non-purchasable plan so it works for subscriptions and quota resolution but
-- never appears on the public pricing grid. Both limit rows are load-bearing —
-- quota resolution deliberately fails open (-1/unlimited) when a row is absent.

ALTER TABLE billing_customers
    ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

ALTER TABLE billing_subscriptions
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_trial_expiry
    ON billing_subscriptions(trial_ends_at)
    WHERE status = 'trialing';

INSERT INTO billing_plans (
    slug,
    name,
    description,
    is_active,
    display_order
)
VALUES (
    'trial',
    'Free Trial',
    'Automatic seven-day cardless trial for newly registered users.',
    FALSE,
    0
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = FALSE,
    updated_at = NOW();

INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, limits.limit_key, limits.limit_value, limits.unit
FROM billing_plans p
CROSS JOIN (
    VALUES
        ('listings_per_month', 1000::BIGINT, 'listings'),
        ('amazon_orders_per_month', 100::BIGINT, 'orders')
) AS limits(limit_key, limit_value, unit)
WHERE p.slug = 'trial'
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();
