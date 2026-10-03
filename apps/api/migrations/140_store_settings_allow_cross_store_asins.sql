-- May a store list an ASIN that is already on the seller's OTHER stores?
-- (operator request, 2026-10-03)
--
-- An ASIN already ACTIVE/DRAFT on the SAME store is always a duplicate. An
-- ASIN that is only on other stores of the seller is allowed on a store when
-- the RESOLVED value of this column is TRUE, refused as a duplicate otherwise
-- (the behaviour before this migration).
--
-- Resolution is Store > Global: a store row holding NULL inherits the global
-- row's value, and a global NULL means off. Existing rows stay NULL, so
-- nothing changes until a seller turns it on.

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS allow_cross_store_asins BOOLEAN NULL;

COMMENT ON COLUMN store_settings.allow_cross_store_asins IS
  'Allow ASINs already ACTIVE/DRAFT on the seller''s other stores. NULL = inherit: a store row follows the global row, a global NULL means off.';
