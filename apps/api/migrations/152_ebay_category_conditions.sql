-- 152: which item conditions an eBay leaf category accepts.
--
-- eBay refuses a publish with "The provided condition id is invalid for the
-- selected primary category id" when the condition we derive from the Amazon
-- title (NEW / NEW_OTHER / USED_EXCELLENT) is not one the category allows
-- (fresh food, for one, accepts a narrow set). The Sell Metadata API's
-- getItemConditionPolicies answers per category; this table caches it per
-- (marketplace, category) the same way ebay_category_aspects caches taxonomy
-- metadata: a fresh row is served, an expired row is refreshed from eBay and
-- served stale (with a warning) when eBay cannot be reached.
--
-- condition_ids holds eBay's numeric condition ids as strings, e.g. ["1000","1500"].
-- Plain tables and JSONB only; applies on a stock Postgres.
CREATE TABLE IF NOT EXISTS ebay_category_conditions (
  marketplace_id     VARCHAR(20) NOT NULL,
  category_id        VARCHAR(20) NOT NULL,
  condition_required BOOLEAN     NOT NULL DEFAULT FALSE,
  condition_ids      JSONB       NOT NULL DEFAULT '[]',
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (marketplace_id, category_id)
);
