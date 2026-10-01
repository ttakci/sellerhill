-- 132: order flow hardening (docs/superpowers/specs/2026-10-01-order-flow-hardening-design.md).
--
-- 1. orders.auto_fulfill_submitted_at — the Place Order CLICK BOUNDARY. Written
--    as a compare-and-set immediately before the click on Amazon. While it is
--    set and the order is not PLACED, the purchase outcome is unknown: nothing
--    may send the order back through the checkout. NULL = no click was sent.
-- 2. orders.ebay_line_item_count — how many line items the eBay order holds.
--    The platform reads only the first; above 1 nothing is bought automatically.
-- 3. orders.ebay_ship_by_date — eBay's ship-by deadline
--    (lineItems[].lineItemFulfillmentInstructions.shipByDate).
-- 4. store_settings.auto_fulfill_max_loss — the seller's loss limit per order
--    (Amazon total minus eBay payout). NULL = no limit.
-- 5. auto_fulfill_events — append-only audit trail of every step of an
--    automatic purchase. Figures and codes only; never a name or an address,
--    so the eBay account-deletion erasure does not need to reach it.
--
-- All new columns are nullable with no default: NULL = not known / not set.
BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auto_fulfill_submitted_at TIMESTAMPTZ NULL,
  -- An Amazon order a scan saw that MAY be the unconfirmed purchase (same
  -- product, dated around the click) but could not be matched with certainty.
  -- Never a link; while it stands the seller cannot declare "not on Amazon".
  ADD COLUMN IF NOT EXISTS auto_fulfill_suspect_amazon_order_id VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS ebay_line_item_count      INTEGER     NULL,
  ADD COLUMN IF NOT EXISTS ebay_ship_by_date         TIMESTAMPTZ NULL;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_fulfill_max_loss NUMERIC(10,2) NULL;

-- Orders that are ALREADY in the unknown state under the old rules get the
-- stamp, so they read as "purchase not confirmed" instead of "blocked":
--   - blocked as no_confirmation / interrupted with no Amazon order linked;
--   - still RUNNING. Migrations run at API boot, after the previous process
--     stopped, so a RUNNING row here is a run that died — and the old code
--     wrote no stamp, so whether it clicked cannot be known. Fail closed.
UPDATE orders
   SET auto_fulfill_submitted_at = COALESCE(auto_fulfill_attempted_at, updated_at, CURRENT_TIMESTAMP)
 WHERE auto_fulfill_submitted_at IS NULL
   AND amazon_order_id IS NULL
   AND (
     auto_fulfill_status::text = 'running'
     OR (
       auto_fulfill_status::text = 'blocked'
       AND auto_fulfill_blocked_reason IN ('no_confirmation', 'interrupted')
     )
   );

-- The "purchase not confirmed" probe (Action Center, reconciliation).
CREATE INDEX IF NOT EXISTS idx_orders_purchase_unknown
  ON orders (user_id, auto_fulfill_submitted_at)
  WHERE auto_fulfill_submitted_at IS NOT NULL AND amazon_order_id IS NULL;

CREATE TABLE IF NOT EXISTS auto_fulfill_events (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ebay_order_id      VARCHAR(60)  NOT NULL,
  user_id            UUID         NULL,
  amazon_account_id  UUID         NULL,
  event              VARCHAR(40)  NOT NULL,
  detail             JSONB        NULL,
  correlation_id     VARCHAR(80)  NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_fulfill_events_order
  ON auto_fulfill_events (ebay_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_fulfill_events_created
  ON auto_fulfill_events (created_at);

COMMIT;
