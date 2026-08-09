-- apps/api/migrations/068_products_category_path.sql
-- Stores the product's FULL Amazon category path so eBay category resolution
-- can be amortized across a niche instead of paid for per ASIN.
--
-- The Commerce Taxonomy API is capped at 5,000 calls/day for the whole
-- application (vs 2,000,000 for Inventory), and `EbayTaxonomyService` was
-- burning one on every new ASIN: it reads an `amazon_category` cache scope but
-- `persistCategoryMappings` only ever wrote the `asin` and `query` scopes, and
-- the query key is a hash of brand+title, unique per product. That capped
-- onboarding at 5,000 new ASINs/day platform-wide.
--
-- The leaf name we already had in `products.category` is too weak to key that
-- cache on — "Accessories" and "Parts" recur under unrelated departments, so
-- one wrong answer would mis-file a whole niche. The full path
-- ("Home & Kitchen > ... > Espresso Machines") is specific enough to reuse.

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_path TEXT;

-- Backfill from the Keepa payload we already keep, so an existing catalog
-- starts amortizing immediately instead of re-paying Taxonomy for every ASIN
-- it has already seen. Derived in SQL rather than by re-fetching: this costs
-- zero provider tokens.
UPDATE products p
SET category_path = derived.path
FROM (
  SELECT
    id,
    (
      SELECT string_agg(node->>'name', ' > ' ORDER BY ordinality)
      FROM jsonb_array_elements(raw_keepa_data->'categoryTree') WITH ORDINALITY AS t(node, ordinality)
      WHERE NULLIF(TRIM(node->>'name'), '') IS NOT NULL
    ) AS path
  FROM products
  WHERE category_path IS NULL
    AND jsonb_typeof(raw_keepa_data->'categoryTree') = 'array'
) AS derived
WHERE p.id = derived.id AND derived.path IS NOT NULL;
