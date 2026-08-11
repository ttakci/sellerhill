-- apps/api/migrations/074_orders_currency.sql
-- Adds the currency `orders` never had (migration 012's CREATE TABLE has no
-- currency column at all). Every eBay Fulfillment API money field already
-- carries its own `currency` alongside `value` — order-sync discarded it and
-- kept only the decimal amount, so every historical row is implicitly USD
-- with no column to say so.
--
-- Only US eBay accounts can be connected today (the OAuth connect flow
-- hardcodes EBAY_MARKETPLACE.US — no marketplace picker exists yet), so
-- `DEFAULT 'USD'` is not a guess: every row this table has ever held, and
-- every row it will hold until that picker ships, genuinely is USD. This is
-- pure insurance ahead of multi-marketplace eBay support — added now while a
-- default backfill is free, rather than later once real order volume makes
-- "what currency was this row in" an open question. It intentionally does
-- NOT change how prices/profit are computed or displayed; that FX-conversion
-- work depends on a real second marketplace to validate against and is
-- deliberately deferred.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
