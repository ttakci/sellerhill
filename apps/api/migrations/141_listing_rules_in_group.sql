-- Listing rules move from store settings into each Listing Settings Group
-- (operator decision 2026-10-03, spec Part A). Blocked ASINs get their own
-- store-settings column (Store > Global, NULL = inherit). The ad-rate setting
-- is dropped from the rules (Ad Campaigns replace it).

ALTER TABLE listing_settings_groups ADD COLUMN IF NOT EXISTS listing_rules JSONB NULL;
COMMENT ON COLUMN listing_settings_groups.listing_rules IS
  'ListingRulesConfig for listings of this group (normalized; NULL = defaults: VeRO on, brand hidden).';

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS blocked_asins JSONB NULL;
COMMENT ON COLUMN store_settings.blocked_asins IS
  'ASINs never listed for this scope. NULL = inherit: a store row follows the global row, a global NULL is none.';

-- Each user's GLOBAL rules (minus the two fields that left them) become every
-- one of their groups' rules. Per-store rule rows are dropped by design
-- (production held only one global row, read 2026-10-03).
UPDATE listing_settings_groups grp
   SET listing_rules = (ss.listing_rules - 'blockedAsins' - 'promotedAdRate')
  FROM store_settings ss
 WHERE ss.user_id = grp.user_id
   AND ss.is_global = TRUE
   AND ss.listing_rules IS NOT NULL
   AND jsonb_typeof(ss.listing_rules) = 'object'
   AND grp.listing_rules IS NULL;

-- Blocked ASINs keep their scope: each row's list moves to its own column.
UPDATE store_settings
   SET blocked_asins = listing_rules->'blockedAsins'
 WHERE listing_rules IS NOT NULL
   AND jsonb_typeof(listing_rules) = 'object'
   AND jsonb_typeof(listing_rules->'blockedAsins') = 'array'
   AND jsonb_array_length(listing_rules->'blockedAsins') > 0
   AND blocked_asins IS NULL;
