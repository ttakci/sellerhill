-- =============================================================================
-- 125: plan prices v3, unlimited automatic orders, Best Sellers product meter.
--
-- Three operator decisions of 2026-09-29, in one migration because they were
-- taken together and the pricing page shows them together.
--
-- 1. NEW MONTHLY PRICES for eleven of the twelve plans. `starter` is UNCHANGED
--    ($44.99) and is deliberately absent from every price statement below — it
--    must not get a new price row, because a new row is what tells
--    `PriceMigrationProcessor` to move every Starter subscriber, and there is
--    nothing to move them to.
--
--      lite        19.99 -> 24.99      growth      104.99 ->  89.99
--      nano        24.99 -> 29.99      advanced    159.99 -> 129.99
--      micro       29.99 -> 34.99      pro         179.99 -> 164.99
--      starter     44.99 (unchanged)   elite       319.99 -> 229.99
--      basic       59.99 -> 54.99      business    429.99 -> 284.99
--      plus        84.99 -> 64.99      enterprise  529.99 -> 339.99
--
--    A PRICE IS NEVER EDITED IN PLACE. A Stripe Price is immutable, and
--    `stripe-catalog-sync` compares every mirrored local row against its
--    Stripe Price and EXITS NON-ZERO on a mismatch — so an in-place UPDATE of
--    `amount_micros` would advertise one figure while Stripe charged another
--    and fail the next deploy step. Instead the currently-open row is closed
--    (`effective_to = CURRENT_DATE`; historical subscriptions keep the price
--    that applied when they paid) and the new price is a NEW open row, exactly
--    as migration 083 did.
--
--    NO OPERATOR COMMAND IS NEEDED AFTER THIS. `PriceMigrationProcessor`
--    (`billing-price-migration`, hourly) first mirrors the new open rows into
--    Stripe (`syncStripeCatalog` — the closed rows keep their `provider_price_id`,
--    the new rows get new Prices), then reads every live subscriber whose plan
--    now has a different current price, schedules the new price from the END
--    of their current period through a Subscription Schedule labelled
--    `price_migration`, and sends the `billing_price_change` e-mail (migration
--    109) once Stripe has accepted the schedule. A seller finishes the period
--    they already paid for at the old price; their next period starts at the
--    new one. Downgraded plans (growth and up) therefore get cheaper at their
--    next renewal, upgraded plans (lite/nano/micro) dearer — same mechanism.
--
-- 2. AUTOMATIC ORDERS BECOME UNLIMITED (-1) ON EVERY PLAN, THE TRIAL INCLUDED.
--    An automatic order costs us no third-party money — the priced unit is the
--    tracking conversion (migration 085) — and every automatic order is backed
--    by a real eBay sale, so the count cannot be farmed. The 2x-conversions
--    anti-abuse ceiling capped exactly the largest, best-paying sellers first.
--    The key is kept and the gate still honours a finite value, so tightening
--    it again is a data change. Capacity is governed by
--    AMAZON_GLOBAL_CONCURRENCY and monitoring, as before.
--
--    `billing_usage_periods.limit_value_snapshot` for already-open AO periods
--    is LEFT AS IS. Nothing enforces from it: the gate resolves the ceiling
--    through `BillingRepositoryService.resolveEffectiveLimit` (plan row +
--    credits) on every call, the billing page and the Action Center read
--    `summary.quotas`, which is derived the same way, and the snapshot is only
--    echoed on `BillingSummaryDto.usagePeriods` for display. Rewriting it here
--    would be touching a column no decision reads.
--
-- 3. A NEW METERED DIMENSION, `best_sellers_products_per_month`: Amazon Best
--    Sellers products a seller may VIEW per billing period (`BillingLimitKey.
--    BEST_SELLERS_PRODUCTS_PER_MONTH`, unit `products`). Counted whether the
--    page came from the shared cache or a live fetch — it meters value
--    delivered, not our cost, which is a fraction of a cent per page — and the
--    same list page reopened on the same UTC day is not counted twice.
--    Exhausting it never refuses a request: the page still renders the products
--    the allowance covers and the rest are removed server-side and shown as
--    locked rows, which is the upgrade / top-up prompt. Three top-up packs are
--    sold on it, credited per billing window like the conversion packs (087).
--
--    The per-day ledger behind the count is `best_sellers_views` (§5): one row
--    per (seller, list page, UTC day) holding how many of that page's products
--    the seller was shown. `SUM(product_count)` over the billing window is the
--    used figure, so — like the conversion meter — there is no separate
--    consumption ledger to drift from the thing it counts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Prices. Every statement is keyed on "the open monthly USD row's amount
--    DIFFERS from the target", so a re-run — or a database that already carries
--    these prices — changes nothing. `starter` is not in the list.
-- -----------------------------------------------------------------------------

-- 1a. Close an open row created on an earlier day whose amount differs.
UPDATE billing_plan_prices pp
SET effective_to = CURRENT_DATE,
    updated_at = NOW()
FROM billing_plans p,
     (VALUES
         ('lite',        24990000::BIGINT),
         ('nano',        29990000),
         ('micro',       34990000),
         ('basic',       54990000),
         ('plus',        64990000),
         ('growth',      89990000),
         ('advanced',   129990000),
         ('pro',        164990000),
         ('elite',      229990000),
         ('business',   284990000),
         ('enterprise', 339990000)
     ) AS v(slug, amount_micros)
WHERE pp.plan_id = p.id
  AND p.slug = v.slug
  AND pp.interval = 'monthly'::billing_price_interval
  AND pp.currency = 'USD'
  AND pp.effective_to IS NULL
  AND pp.amount_micros <> v.amount_micros
  AND pp.effective_from < CURRENT_DATE;

-- 1b. An open row created TODAY with a different amount cannot be closed —
--     `billing_plan_prices_window_order` requires effective_to > effective_from
--     — so it is removed, exactly as 083 §1 does. This only fires when 125 runs
--     on the same day the catalog was seeded (a fresh install), where no Stripe
--     Price has been minted for it yet; subscriptions reference the plan, never
--     a price row, so nothing dangles.
DELETE FROM billing_plan_prices pp
USING billing_plans p,
      (VALUES
          ('lite',        24990000::BIGINT),
          ('nano',        29990000),
          ('micro',       34990000),
          ('basic',       54990000),
          ('plus',        64990000),
          ('growth',      89990000),
          ('advanced',   129990000),
          ('pro',        164990000),
          ('elite',      229990000),
          ('business',   284990000),
          ('enterprise', 339990000)
      ) AS v(slug, amount_micros)
WHERE pp.plan_id = p.id
  AND p.slug = v.slug
  AND pp.interval = 'monthly'::billing_price_interval
  AND pp.currency = 'USD'
  AND pp.effective_to IS NULL
  AND pp.amount_micros <> v.amount_micros
  AND pp.effective_from >= CURRENT_DATE;

-- 1c. Insert the new open row for every listed plan that now has none. After
--     1a/1b a plan has no open row iff its price changed, so a plan already on
--     the target price is skipped and its `provider_price_id` survives. The
--     ON CONFLICT mirrors 083 §4 for the concurrent-boot case; the NOT EXISTS
--     is what keeps the statement a no-op on a re-run.
INSERT INTO billing_plan_prices (plan_id, interval, amount_micros, currency, effective_from, effective_to)
SELECT p.id, 'monthly'::billing_price_interval, v.amount_micros, 'USD', CURRENT_DATE, NULL
FROM (VALUES
    ('lite',        24990000::BIGINT),
    ('nano',        29990000),
    ('micro',       34990000),
    ('basic',       54990000),
    ('plus',        64990000),
    ('growth',      89990000),
    ('advanced',   129990000),
    ('pro',        164990000),
    ('elite',      229990000),
    ('business',   284990000),
    ('enterprise', 339990000)
) AS v(slug, amount_micros)
JOIN billing_plans p ON p.slug = v.slug
WHERE NOT EXISTS (
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

-- -----------------------------------------------------------------------------
-- 2. Automatic orders: unlimited on every plan, trial and retired plans alike.
--    Idempotent by predicate — a row already at -1 is not rewritten.
-- -----------------------------------------------------------------------------
UPDATE billing_plan_limits
SET limit_value = -1,
    updated_at = NOW()
WHERE limit_key = 'amazon_orders_per_month'
  AND limit_value <> -1;

-- -----------------------------------------------------------------------------
-- 3. Best Sellers product allowance per billing period, all thirteen plans.
--    Retired `scale` (052) is not listed: nobody can subscribe to it, and an
--    absent row resolves to unlimited, which for a meter that costs us a
--    fraction of a cent per page is the harmless direction (unlike 085 §1b,
--    where the absent row would have meant unlimited paid conversions).
-- -----------------------------------------------------------------------------
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit)
SELECT p.id, 'best_sellers_products_per_month', v.limit_value, 'products'
FROM (VALUES
    ('trial',        500::BIGINT),
    ('lite',        1500),
    ('nano',        2500),
    ('micro',       5000),
    ('starter',     7500),
    ('basic',      10000),
    ('plus',       12500),
    ('growth',     15000),
    ('advanced',   20000),
    ('pro',        25000),
    ('elite',      35000),
    ('business',   50000),
    ('enterprise', 75000)
) AS v(slug, limit_value)
JOIN billing_plans p ON p.slug = v.slug
ON CONFLICT (plan_id, limit_key) DO UPDATE SET
    limit_value = EXCLUDED.limit_value,
    unit = EXCLUDED.unit,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 4. Top-up packs on the new meter. Same rules as 087/113: ordinary rows,
--    mirrored to Stripe as ONE-TIME prices by the hourly catalog sync (no
--    command), offered only to a seller who has actually reached the limit,
--    raising the CURRENT billing window's ceiling only. display_order 100+
--    puts them after the conversion packs in any combined listing.
-- -----------------------------------------------------------------------------
INSERT INTO billing_quota_addons (slug, limit_key, quantity, amount_micros, display_order)
VALUES
    ('best-sellers-2500',  'best_sellers_products_per_month',  2500,  4990000, 100),
    ('best-sellers-10000', 'best_sellers_products_per_month', 10000, 14990000, 110),
    ('best-sellers-25000', 'best_sellers_products_per_month', 25000, 29990000, 120)
ON CONFLICT (slug) DO UPDATE SET
    limit_key = EXCLUDED.limit_key,
    quantity = EXCLUDED.quantity,
    amount_micros = EXCLUDED.amount_micros,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 5. The view ledger the meter is counted from.
--
--    One row per (seller, list page, UTC day). `view_key` is the same
--    country/list-type/category/page tuple the shared Redis cache is keyed on,
--    so a page reopened on the same day lands on the same row and is not
--    counted twice; `product_count` is how many of that page's products the
--    seller was actually shown (≤ the page size), which is what a later
--    top-up raises. `viewed_at` is the age column both the billing-window SUM
--    and the nightly `data-retention` job read.
--
--    Grants follow the standing convention for tables created after 021
--    (087, 119): none here — the application connects as the schema owner.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS best_sellers_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view_key VARCHAR(200) NOT NULL,
    viewed_on DATE NOT NULL,
    product_count INTEGER NOT NULL CHECK (product_count >= 0),
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, view_key, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_best_sellers_views_user_viewed_at
    ON best_sellers_views(user_id, viewed_at);

COMMENT ON TABLE best_sellers_views IS
    'Per-day ledger of Best Sellers products shown to a seller; SUM(product_count) over the billing window is the best_sellers_products_per_month usage. Purged by the data-retention job.';
