-- 147: remember that the seller answered a cancellation request from SellerHill.
--
-- eBay keeps returning sellerResponseDueDate after the seller has answered
-- (production, 2026-10-07: cancel 5456020649 approved at 18:35:48, still
-- carrying the due date while eBay processed the refund, closed at 18:36:05).
-- The bucket read that as "answer now", so the request stayed under
-- "Action needed" until the next sweep saw the close, and a second click could
-- send a second answer. The answer we sent is our own fact, so it is stored:
-- an answered, still-open request reads as ANSWERED and offers no action.
--
-- seller_answer holds EbayCancellationAction ('approve' | 'reject'). Written
-- only by EbayCancellationsActionsService after eBay accepted the call; the
-- sweep never writes either column.
BEGIN;

ALTER TABLE ebay_cancellations
  ADD COLUMN IF NOT EXISTS seller_answered_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS seller_answer      VARCHAR(16) NULL;

COMMIT;
