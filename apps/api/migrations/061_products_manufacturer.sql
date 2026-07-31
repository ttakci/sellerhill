-- 061: `products.manufacturer`.
--
-- Split out of migration 060 because 060 had already been applied to running
-- databases when this column was added, and the runner never re-executes an
-- applied file. Amending an applied migration is silently a no-op — new columns
-- always ship as a new file.
--
-- The manufacturer was previously squeezed into `products.category` as a
-- fallback and read back as `brand`, so the eBay "Manufacturer" item specific
-- could never differ from Brand (e.g. brand "Fruit by the Foot" vs manufacturer
-- "GENERAL MILLS").

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200);

COMMENT ON COLUMN products.manufacturer IS
  'Amazon/Keepa manufacturer, distinct from brand; used for the eBay Manufacturer item specific.';
