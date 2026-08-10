-- apps/api/migrations/070_predefined_templates_slug.sql
-- Gives `predefined_templates` the stable natural key it never had, so the
-- listing description catalog can move out of application code and into the
-- database (the catalog rows themselves land in 071).
--
-- Why a natural key is required, and why a plain "INSERT the catalog" migration
-- would have been a data-loss bug: `predefined_templates.id` is a random UUID
-- and `listing_settings_groups.templates->>'predefinedTemplateId'` points at it
-- from INSIDE a JSONB column, so Postgres cannot enforce a foreign key. Every
-- existing database already holds rows minted by the old boot-time seed
-- (ListingSettingsGroupService.seedPredefinedTemplates) with unpredictable ids.
-- A migration that inserted fresh rows would therefore not adopt them — it would
-- create a SECOND copy and detach every user's template choice, which then
-- degrades silently to DEFAULT_LISTING_TEMPLATE_HTML on publish while the UI
-- keeps showing the chosen template's name (listing-strategy.service.ts,
-- resolveTemplateHtml). Deriving a slug from the existing name lets 071 upsert
-- ON CONFLICT (slug) and leave `id` alone.
--
-- Statement order below is load-bearing: each step's precondition is the
-- previous step's postcondition. MigrationRunner executes every pending file in
-- ONE transaction, so any failure here rolls back the whole boot-time migration
-- run and the API does not start.

-- 1. Columns. `slug` must be added NULLABLE — a NOT NULL column without a
--    default cannot be added to a table that already has rows.
--    `sort_order` exists because ordering by created_at would make catalog order
--    an artifact of seed history: the rows adopted below keep their old
--    timestamps while every row 071 inserts gets the same NOW().
--    `is_active` is the soft-retire switch. With no FK, DELETE is never safe.
ALTER TABLE predefined_templates
  ADD COLUMN IF NOT EXISTS slug       VARCHAR(64),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Derive each existing row's slug from its name.
--    'Modern Professional' -> 'modern-professional', 'Elite Trust' -> 'elite-trust',
--    i.e. exactly the slugs 071 upserts on, so those two rows keep their id and
--    created_at and every group pointing at them still resolves.
--    Derivation rather than a hand-written name map on purpose: it also absorbs
--    case, whitespace and punctuation variants a hand map would miss.
UPDATE predefined_templates
SET slug = LEFT(
  NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(TRIM(name)), '[^a-z0-9]+', '-', 'g')), ''),
  64
)
WHERE slug IS NULL;

-- 3. Fallback for any row whose name yields no usable slug (empty or
--    punctuation-only). LEFT(NULL, 64) is NULL, so those rows are still NULL
--    here. This guarantees step 6's SET NOT NULL cannot fail, and guarantees the
--    row is NOT adopted by 071 — it keeps its own id, so groups pointing at it
--    keep working; an operator can retire it later with is_active = FALSE.
UPDATE predefined_templates
SET slug = 'template-' || LEFT(REPLACE(id::text, '-', ''), 12)
WHERE slug IS NULL;

-- 4. Repoint settings groups off duplicate rows BEFORE deleting them — the
--    old TypeScript self-heal, ported to SQL and run once. Deleting first would
--    leave dangling ids (that ordering bug is why the TS version carried the
--    same comment).
--
--    Deduplication partitions on the DERIVED SLUG, not on `name`: rows named
--    'Elite Trust' and 'elite trust ' both survive a name-based dedup, both
--    resolve to slug 'elite-trust', and the unique index in step 6 then fails —
--    taking the whole migration run, and API boot, with it.
--
--    The jsonb_typeof guard is mandatory. `listing_settings_groups.templates` is
--    JSONB NOT NULL but nothing constrains it to an object, and jsonb_set on a
--    scalar raises "cannot set path in scalar". (`->>` on a scalar just returns
--    NULL, so only jsonb_set needs the guard.)
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS keep_id,
    ROW_NUMBER()    OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS rn
  FROM predefined_templates
)
UPDATE listing_settings_groups g
SET templates  = jsonb_set(g.templates, '{predefinedTemplateId}', to_jsonb(r.keep_id::text), true),
    updated_at = CURRENT_TIMESTAMP
FROM ranked r
WHERE r.rn > 1
  AND jsonb_typeof(g.templates) = 'object'
  AND g.templates ->> 'predefinedTemplateId' = r.id::text;

-- 5. Delete the duplicates. Same window expression as step 4, therefore the
--    same survivor.
DELETE FROM predefined_templates p
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at NULLS LAST, id) AS rn
  FROM predefined_templates
) r
WHERE p.id = r.id
  AND r.rn > 1;

-- 6. Lock it in. This unique index is what structurally replaces the boot-time
--    seed's duplicate self-heal: duplicates can no longer be created, so there
--    is nothing left to heal. CREATE UNIQUE INDEX CONCURRENTLY is impossible
--    here (MigrationRunner runs inside a transaction) and unnecessary — the
--    table holds well under 100 rows.
ALTER TABLE predefined_templates ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS predefined_templates_slug_key
  ON predefined_templates (slug);

COMMENT ON COLUMN predefined_templates.slug IS
  'Stable natural key. Catalog updates address rows by slug (ON CONFLICT (slug) DO UPDATE) and must never rewrite id — groups reference id from JSONB with no FK.';
COMMENT ON COLUMN predefined_templates.is_active IS
  'Soft retire. Hidden from the picker; still resolvable by getPredefinedTemplateHtml so listings already using it keep rendering it. Never DELETE a catalog row.';
