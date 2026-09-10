-- Migration 098: capture the REAL eBay fee figures that already arrive in the
-- `getOrders` payload, and the Collect & Remit tax that settles an open question
-- about `net_profit`.
--
-- These three fields are in every order response we already download every sync
-- tick; nothing read them. `orders.transaction_fee` / `ad_fee` are instead
-- derived from the `ebayFeePercent` / `fixedFeeAmount` a seller typed into their
-- Listing Settings Group — a PRICING input, not a record of what eBay charged.
-- So the dashboard's "transaction fees" / "ad fees" rows are estimates today.
-- Reading these costs ZERO extra API calls.
--
-- `ebay_collect_remit_tax` is here for a narrower and more urgent reason. eBay's
-- own documentation contradicts itself about whether Collect & Remit sales tax
-- is inside `paymentSummary.totalDueSeller` for a Managed Payments seller: the
-- PaymentSummary type page says it is; the Collect & Remit announcement says
-- that for managed-payments sellers the tax "appears in the
-- eBayCollectAndRemitTaxes container only". Every SellerHill seller is Managed
-- Payments and eBay US is our only marketplace, so the answer decides whether
-- `net_profit` overstates by the sales tax on every order (~7-8% of item price,
-- against a typical $8-10 net profit). Verified separately and NOT in doubt:
-- `totalDueSeller` = `pricingSummary.total` - `totalMarketplaceFee`, i.e. eBay's
-- commission IS already deducted.
--
-- With all three stored the check on the first real US order is exact
-- arithmetic, not an inference from an assumed fee percentage:
--   ebay_earnings = sale_total - ebay_marketplace_fee                  -> tax IS inside earnings
--   ebay_earnings = sale_total - ebay_marketplace_fee - ebay_collect_remit_tax -> tax is excluded
--
-- NULLABLE with no default, deliberately: NULL means "eBay reported nothing",
-- 0 means "eBay reported zero" — the same discipline `orders.net_profit` keeps
-- (migration 033). A DEFAULT 0 would make an uncaptured fee indistinguishable
-- from a genuinely free order, which is the exact question these columns exist
-- to answer. Every pre-existing row stays NULL; no backfill is possible, since
-- eBay is the only source and order sync never re-fetches an old order.
--
-- Capture only. Nothing reads these yet: net_profit, the dashboard and the
-- transaction_fee/ad_fee derivation are all unchanged by this migration.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ebay_marketplace_fee DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS ebay_fee_basis_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS ebay_collect_remit_tax DECIMAL(12,2);

COMMENT ON COLUMN orders.ebay_marketplace_fee IS
  'eBay getOrders totalMarketplaceFee — the real fees eBay deducted from the seller payout. NULL = not reported by eBay, 0 = eBay reported zero.';

COMMENT ON COLUMN orders.ebay_fee_basis_amount IS
  'eBay getOrders totalFeeBasisAmount — the amount totalMarketplaceFee was calculated on. NULL = not reported by eBay.';

COMMENT ON COLUMN orders.ebay_collect_remit_tax IS
  'Sum of lineItems[].ebayCollectAndRemitTaxes[].amount. Decides whether Collect & Remit sales tax sits inside ebay_earnings (totalDueSeller). NULL = not reported by eBay.';
