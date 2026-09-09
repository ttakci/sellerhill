-- 096: add 'publish' to the listing_job_kind enum.
--
-- Draft → live publish (POST /listings/bulk-publish) is synchronous — the
-- seller is waiting, so it does NOT go through the BullMQ listings queue like
-- create/import. Until now it also left no listing_jobs row at all, so a
-- partial failure ("2 of 3 drafts published") was invisible: no entry in the
-- jobs list, no detail page, the reason only in the API log.
--
-- This kind lets the synchronous publish path write a listing_jobs +
-- listing_job_items record (filled in directly, no worker) so it appears in
-- the same jobs list and gets the same per-item failure_code detail view as
-- 'create' / 'existing_import'.
--
-- ALTER TYPE ... ADD VALUE is allowed inside a transaction on PostgreSQL 12+
-- (the migrate.ts runner wraps the batch in one); the new value is only USED
-- by application code at runtime, never within this migration, so the
-- same-transaction restriction does not apply.

ALTER TYPE listing_job_kind ADD VALUE IF NOT EXISTS 'publish';
