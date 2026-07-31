-- 060: Persist product attributes used as eBay item specifics.
--
-- `specs` (Color/Size/MPN/Item Weight/variation dimensions/…) and `identifiers`
-- (UPC/EAN/MPN/model) were normalized on the create path but never stored, so
-- every cache hit — the common case for re-lists and bulk adds — published a
-- listing with only Brand plus whatever eBay demanded, auto-filled as "Unknown".
-- Storing them makes the shared ASIN cache serve full item specifics without a
-- second Keepa call.

-- NOTE: `products.manufacturer` belongs to this change conceptually but ships in
-- migration 061 — this file was already applied to running databases when the
-- column was added, and an applied migration never re-runs.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS identifiers JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN products.specs IS
  'Item-specific-ready attribute map (name -> value) normalized from Keepa.';
COMMENT ON COLUMN products.identifiers IS
  'Catalog identifiers {upc, ean, mpn, model, isbn}; GTINs are check-digit validated before insert.';
