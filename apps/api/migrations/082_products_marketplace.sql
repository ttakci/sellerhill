-- apps/api/migrations/082_products_marketplace.sql
-- Products become marketplace-aware ahead of a second Amazon marketplace.
-- `asin` alone stops being a valid identity key once a product can be
-- sourced from two independent storefronts (the same ASIN string can be a
-- different product on amazon.com vs. a future amazon.co.uk). Added now,
-- while every existing row is unambiguously 'AMAZON_US' and the backfill is
-- a free DEFAULT, rather than later once real catalog volume makes the old
-- asin-only uniqueness load-bearing. Mirrors 074_orders_currency.sql.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS marketplace VARCHAR(20) NOT NULL DEFAULT 'AMAZON_US';

-- Swap the implicit single-column uniqueness (`products_asin_key`, created by
-- the inline UNIQUE in 006_create_products.sql) for a composite one. No FK
-- anywhere references products.asin (all reference products.id), so this is
-- safe. 006 is never edited/re-run — the swap ships as new DDL here.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_asin_key;
ALTER TABLE products ADD CONSTRAINT products_asin_marketplace_key UNIQUE (asin, marketplace);

-- idx_products_asin (plain btree on asin) is left untouched — it still
-- serves ASIN-only admin/debug lookups and doesn't need to be dropped for
-- the uniqueness swap.
