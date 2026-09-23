-- apps/api/migrations/115_predefined_templates_drop_ds_prefix.sql
-- Strips the "DS " prefix from the 12 template names seeded by migration 073.
--
-- The picker labels a template from its SLUG via the i18n catalog and only
-- falls back to this column when a translation is missing, so this column is
-- the name of record rather than the usual render path. It still has to be
-- right: the fallback is what a seller sees the moment a locale is incomplete,
-- and "DS Toys Kids" is exactly what showed in the Turkish dropdown while the
-- i18n key was misspelled (`ds-kids-toys` vs the real `ds-toys-kids`).
--
-- Names only. Slugs are the stable natural key that `listing_settings_groups
-- .templates->>'predefinedTemplateId'` and the i18n catalog both resolve
-- against, and renaming one would detach every group pointing at it.
--
-- Idempotent: the WHERE clause matches nothing on a second run, and an applied
-- migration never re-runs anyway.

UPDATE predefined_templates
SET name = TRIM(SUBSTRING(name FROM 4))
WHERE name LIKE 'DS %';
