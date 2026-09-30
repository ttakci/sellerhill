-- 129_order_change_backfill.sql
--
-- Split from 128 on purpose: 128 (columns + ebay_returns) was already applied
-- to databases before this statement existed, and an applied migration never
-- re-runs. A data step therefore ships as its own file.

BEGIN;
-- One-time backfill of the new cancel/refund columns. Order sync used to read
-- an order exactly once (creation-date windows), so every order already held
-- has never had its later cancellation or refund looked at. Rewinding each
-- store's watermark makes the next tick re-read what eBay modified in the last
-- 90 days through the normal path: existing rows are UPDATED (status merged
-- forward-only, cancel/refund columns filled); nothing is bought, no stock is
-- moved and no buyer is messaged, because those fire only for an order that is
-- both newly inserted and recent (decideIngest). Bounded at 90 days so a large
-- store costs a few pages, not its whole history; never earlier than the
-- store's connection.
UPDATE ebay_accounts
   SET last_ebay_sync_at = GREATEST(created_at, NOW() - INTERVAL '90 days')
 WHERE last_ebay_sync_at IS NOT NULL;

COMMIT;
