-- 062: eBay category + item-specifics intelligence.
--
-- Three problems this solves, all of which used to end in a failed listing:
--
-- 1. Category aspect metadata lived only in a per-process 1h Map. A taxonomy
--    outage (or a cold worker) meant no metadata at all, and the create path
--    published a Brand-only listing that failed on every required specific.
-- 2. Category resolution re-asked the taxonomy for every ASIN and had no way to
--    record "this Amazon category always maps to that eBay category" — and no
--    way for an operator to pin a mapping when eBay's suggestion was wrong.
-- 3. Nothing was ever learned. A value that published successfully was
--    recomputed from scratch next time, and a value eBay rejected was tried
--    again forever.
--
-- Nothing here is on the hot path for a healthy create: one indexed read per
-- listing, in front of the existing in-process cache.

-- 1. Taxonomy metadata cache. Rows are served stale (with a warning) when the
--    taxonomy API is unreachable — stale metadata beats no metadata.
CREATE TABLE IF NOT EXISTS ebay_category_aspects (
  marketplace_id   VARCHAR(32) NOT NULL,
  category_tree_id VARCHAR(16) NOT NULL,
  category_id      VARCHAR(20) NOT NULL,
  aspects          JSONB       NOT NULL,
  aspect_count     INTEGER     NOT NULL DEFAULT 0,
  required_count   INTEGER     NOT NULL DEFAULT 0,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (marketplace_id, category_tree_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_ebay_category_aspects_expires
  ON ebay_category_aspects (expires_at);

-- 2. Category resolution cache and operator pins.
--    `scope` lets one table answer "for this ASIN", "for this Amazon category"
--    and "for this search query" without three near-identical tables.
CREATE TABLE IF NOT EXISTS ebay_category_map (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id   VARCHAR(32) NOT NULL,
  category_tree_id VARCHAR(16) NOT NULL,
  scope            VARCHAR(16) NOT NULL,
  scope_key        TEXT        NOT NULL,
  category_id      VARCHAR(20) NOT NULL,
  category_name    TEXT        NOT NULL,
  source           VARCHAR(16) NOT NULL DEFAULT 'taxonomy',
  is_locked        BOOLEAN     NOT NULL DEFAULT FALSE,
  hit_count        BIGINT      NOT NULL DEFAULT 0,
  last_used_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ebay_category_map_scope_ck  CHECK (scope IN ('asin', 'amazon_category', 'query')),
  CONSTRAINT ebay_category_map_source_ck CHECK (source IN ('taxonomy', 'curated')),
  -- Category 1 is eBay's ROOT, not a listable leaf. Storing it guaranteed a
  -- later publish failure, so the database refuses it outright.
  CONSTRAINT ebay_category_map_leaf_ck   CHECK (category_id ~ '^[0-9]+$' AND category_id <> '1')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ebay_category_map_scope
  ON ebay_category_map (marketplace_id, category_tree_id, scope, scope_key);

-- 3. Curated (operator) and learned (self-taught) item-specific values.
--    Two partial unique indexes encode the model: exactly ONE curated value per
--    aspect, but MANY learned candidates ranked by how often they published.
CREATE TABLE IF NOT EXISTS ebay_aspect_defaults (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_id VARCHAR(32) NOT NULL,
  category_id    VARCHAR(20) NOT NULL,
  aspect_key     VARCHAR(80) NOT NULL,
  aspect_name    TEXT        NOT NULL,
  value          TEXT        NOT NULL,
  source         VARCHAR(16) NOT NULL,
  origin_layer   VARCHAR(20) NOT NULL,
  is_override    BOOLEAN     NOT NULL DEFAULT FALSE,
  confidence     SMALLINT    NOT NULL DEFAULT 50,
  use_count      BIGINT      NOT NULL DEFAULT 0,
  success_count  BIGINT      NOT NULL DEFAULT 0,
  failure_count  BIGINT      NOT NULL DEFAULT 0,
  stale_at       TIMESTAMPTZ,
  last_used_at   TIMESTAMPTZ,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ebay_aspect_defaults_source_ck     CHECK (source IN ('curated', 'learned')),
  CONSTRAINT ebay_aspect_defaults_confidence_ck CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT ebay_aspect_defaults_override_ck   CHECK (is_override = FALSE OR source = 'curated')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ebay_aspect_defaults_curated
  ON ebay_aspect_defaults (marketplace_id, category_id, aspect_key)
  WHERE source = 'curated';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ebay_aspect_defaults_learned
  ON ebay_aspect_defaults (marketplace_id, category_id, aspect_key, value)
  WHERE source = 'learned';

CREATE INDEX IF NOT EXISTS idx_ebay_aspect_defaults_lookup
  ON ebay_aspect_defaults (marketplace_id, category_id)
  WHERE stale_at IS NULL;

-- 4. Per-listing audit. `ebay_category_id` was never stored (only the display
--    name), which makes any future revise/repair batch impossible.
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ebay_category_id        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS aspect_resolution       JSONB,
  ADD COLUMN IF NOT EXISTS aspect_autofilled_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_aspect_autofilled
  ON listings (user_id, aspect_autofilled_count)
  WHERE aspect_autofilled_count > 0;

COMMENT ON TABLE ebay_aspect_defaults IS
  'Curated + learned item-specific values per (marketplace, category, aspect). Learned rows are revalidated against the category allowed-value list on every read.';
COMMENT ON COLUMN listings.aspect_resolution IS
  'Which layer resolved each item specific at create time; drives the "review item specifics" badge.';
