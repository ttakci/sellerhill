-- Periodic listing reconciliation through the eBay Feed API.
--
-- `GetMyeBaySelling` charges one metered Trading call per 200 listings against
-- a 5,000/day ceiling shared by the whole application, so a nightly scan of
-- every seller was never affordable there. `LMS_ACTIVE_INVENTORY_REPORT` is one
-- report per seller whatever the catalogue size, on a 100,000/day ceiling.
--
-- This column is the claim/watermark that spreads that sweep out: the scheduler
-- takes the most-overdue accounts each tick rather than fanning out across all
-- of them at once. That matters more than usual here because eBay meters feed
-- TASKS separately from calls (errors 160024 and 160025 — concurrent, and per
-- hour/day) and publishes no figure for either, so the sweep has to stay paced
-- until real numbers are observed.
--
-- NULL means "never swept", which sorts first: a newly connected store is
-- reconciled on the next tick rather than waiting out a full interval.

ALTER TABLE ebay_accounts
    ADD COLUMN IF NOT EXISTS last_feed_sync_at TIMESTAMPTZ;

-- Partial, because the sweep only ever considers active stores — a disconnected
-- or revoked account has no token to spend and nothing to reconcile.
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_feed_sync_due
    ON ebay_accounts (last_feed_sync_at NULLS FIRST)
    WHERE status = 'active';
