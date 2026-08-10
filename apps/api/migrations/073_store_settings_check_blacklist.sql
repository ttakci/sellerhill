-- Replace the two structural validation toggles (validate_title,
-- validate_description) with a single blacklist-scan master switch.
-- Each blacklist keyword already carries its own `types` (title/description/
-- feature_specification/brand_manufacturer), so a per-field validation toggle
-- was redundant with — and disconnected from — that per-keyword scope.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS check_blacklist BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE store_settings
  DROP COLUMN IF EXISTS validate_title,
  DROP COLUMN IF EXISTS validate_description;
