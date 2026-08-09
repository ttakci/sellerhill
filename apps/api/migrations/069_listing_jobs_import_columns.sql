-- apps/api/migrations/069_listing_jobs_import_columns.sql
-- Re-applies the tail of 065_ebay_listing_import.sql, which never ran on any
-- database that had already executed an earlier version of that file.
--
-- 065 was amended after it had been applied. An applied migration is never
-- re-run — the runner records it by filename and skips it forever — so the
-- statements appended later were a silent no-op on every existing database
-- while looking perfectly applied on a fresh one. The symptom was a 500 on
-- POST /v1/listings/bulk-create:
--   column "ebay_account_id" of relation "listing_jobs" does not exist
-- with `065_ebay_listing_import.sql` sitting in the migrations table.
--
-- This is exactly the failure mode migration 061 was split out to avoid. The
-- fix is never to edit the original: ship the missing statements as a new file.
--
-- Every statement here is idempotent, so this is a no-op on a database that
-- did get the complete 065.

-- CREATE TYPE has no IF NOT EXISTS, so it needs the guard the original lacked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_job_kind') THEN
    CREATE TYPE listing_job_kind AS ENUM ('create', 'existing_import');
  END IF;
END
$$;

ALTER TABLE listing_jobs
    ADD COLUMN IF NOT EXISTS kind listing_job_kind NOT NULL DEFAULT 'create',
    ADD COLUMN IF NOT EXISTS ebay_account_id UUID REFERENCES ebay_accounts(id) ON DELETE SET NULL;

ALTER TABLE listing_job_items
    ADD COLUMN IF NOT EXISTS source_row INTEGER,
    ADD COLUMN IF NOT EXISTS source_ebay_item_id VARCHAR(50);
