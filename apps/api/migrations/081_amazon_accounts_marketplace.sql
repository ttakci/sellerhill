-- apps/api/migrations/081_amazon_accounts_marketplace.sql
-- Amazon buyer accounts become marketplace-aware. Only amazon.com (US) is
-- selectable today (AmazonMarketplace has a single member — see
-- packages/shared/src/domain/amazon/amazon.enums.ts), but the column exists
-- now while the backfill is free, so "which storefront is this buyer account
-- for" is never an open question once a second Amazon marketplace is real.
-- Mirrors the reasoning in 074_orders_currency.sql for eBay's currency
-- column. No index: amazon_accounts is queried by id/user_id, never filtered
-- by marketplace alone today.
ALTER TABLE amazon_accounts
  ADD COLUMN IF NOT EXISTS marketplace VARCHAR(20) NOT NULL DEFAULT 'AMAZON_US';
