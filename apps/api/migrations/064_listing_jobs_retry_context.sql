-- 064: keep the settings a listing job was created with.
--
-- The settings group and the three eBay policy ids existed only inside the
-- BullMQ job payload, which is removed on completion. So a failed ASIN could
-- not be retried at all — the server no longer knew which group or policies to
-- publish it with, and the user had to re-run the whole import.
--
-- Rows created before this migration keep NULLs; retry is refused for them with
-- a clear message rather than guessing a settings group.

ALTER TABLE listing_jobs
  ADD COLUMN IF NOT EXISTS listing_settings_group_id UUID REFERENCES listing_settings_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_policy_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_policy_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS return_policy_id   VARCHAR(100);

COMMENT ON COLUMN listing_jobs.listing_settings_group_id IS
  'Settings the job was created with; required to re-queue a single failed item.';
