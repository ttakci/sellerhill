-- 130: a durable "this buyer's data was erased" marker.
--
-- eBay's Marketplace Account Deletion notification makes us null a buyer's
-- name / e-mail / phone / shipping address on their orders. Until order sync
-- started re-reading modified orders (migration 128) nothing ever wrote those
-- columns again. Now a re-read overwrites shipping_address with whatever eBay
-- returns, and the return sweep rewrites the buyer's login name and comment on
-- every pass — so an erasure has to be remembered, not just performed.
--
-- NULL = never erased. Set once by EbayAccountDeletionService; the order
-- upsert and the return upsert refuse to restore buyer data on a marked row.

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_data_erased_at TIMESTAMPTZ NULL;

ALTER TABLE ebay_returns
  ADD COLUMN IF NOT EXISTS buyer_data_erased_at TIMESTAMPTZ NULL;

-- Erasures that already happened: the audit row written at the time names the
-- eBay username, which is what orders.buyer_username still holds.
UPDATE orders o
   SET buyer_data_erased_at = a.erased_at
  FROM (
    SELECT (details::jsonb)->>'username' AS username, MIN(created_at) AS erased_at
      FROM audit_logs
     WHERE action = 'EBAY_ACCOUNT_DELETION'
       AND (details::jsonb)->>'username' IS NOT NULL
     GROUP BY 1
  ) a
 WHERE o.buyer_username = a.username
   AND o.buyer_data_erased_at IS NULL;

COMMIT;
