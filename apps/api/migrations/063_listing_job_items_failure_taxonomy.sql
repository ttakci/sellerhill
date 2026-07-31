-- 063: structured failure reasons on listing job items.
--
-- Until now every failure — billing quota, zero stock, a Keepa miss, an eBay
-- item-specific rejection, an expired OAuth token — arrived in the UI as one
-- opaque string straight from eBay, rendered in a 4.5rem scroll box. The user
-- could not tell an "act on this" failure from a "retry later" one, and there
-- was no retry affordance at all.
--
-- `failure_code` is the shared ListingFailureCode enum; `failure_details`
-- carries the structured context the UI interpolates (aspect names, category,
-- eBay error ids). The raw message stays in `error_message` behind a
-- "technical details" disclosure.

ALTER TABLE listing_job_items
  ADD COLUMN IF NOT EXISTS failure_code    VARCHAR(48),
  ADD COLUMN IF NOT EXISTS failure_details JSONB;

CREATE INDEX IF NOT EXISTS idx_listing_job_items_failure_code
  ON listing_job_items (failure_code)
  WHERE failure_code IS NOT NULL;

COMMENT ON COLUMN listing_job_items.failure_code IS
  'Shared ListingFailureCode; drives the localized message and whether a retry is offered.';
