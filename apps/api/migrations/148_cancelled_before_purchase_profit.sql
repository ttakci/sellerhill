-- 148: one-time fix of orders eBay cancelled before anything was bought.
--
-- recomputeProfit estimated their cost from the product's Amazon price, so a
-- cancelled sale nobody bought showed a loss of that price (production
-- 2026-10-07: 11-15260-92166, earnings 0.00, profit -10.49). From now on
-- recomputeProfit sets cost 0 and profit = ebay_earnings for such an order
-- (isCancelledBeforePurchase, profit-calculation.ts); this migration applies the
-- same rule to the rows already written, because nothing re-runs recompute on
-- an order whose earnings no longer change. The same three conditions: no
-- Amazon order id, no Place Order click stamp, not PLACED. Untracked rows
-- (no estimate was ever written) are left alone.
BEGIN;

UPDATE orders
   SET purchase_price = 0,
       net_profit     = ROUND(COALESCE(ebay_earnings, 0), 2),
       updated_at     = CURRENT_TIMESTAMP
 WHERE status = 'cancelled'
   AND listing_id IS NOT NULL
   AND COALESCE(amazon_order_id, '') = ''
   AND auto_fulfill_submitted_at IS NULL
   AND auto_fulfill_status <> 'placed';

COMMIT;
