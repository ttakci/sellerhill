-- 128: order change tracking (eBay cancellation + refund) and eBay returns.
--
-- Until now an order was fetched from eBay exactly once (the sync filtered on
-- creationdate), so a cancellation, a refund or a status change made on eBay
-- afterwards was never observed. Order sync now filters on lastmodifieddate and
-- re-reads changed orders; these columns hold what it learns.
--
-- Field meanings are eBay's own (docs/ebay-reference/sell-fulfillment-v1-oas3.json):
--   cancelStatus.cancelState / cancelStatus.cancelledDate
--   paymentSummary.refunds[].amount / refundDate
-- All nullable with no default: NULL = eBay reported nothing.
BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ebay_cancel_state     VARCHAR(40)   NULL,
  ADD COLUMN IF NOT EXISTS ebay_cancelled_at     TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS ebay_refunded_amount  NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS ebay_refunded_at      TIMESTAMPTZ   NULL;

-- The "eBay cancelled this sale but an Amazon order is still open" probe.
CREATE INDEX IF NOT EXISTS idx_orders_ebay_cancelled_at
  ON orders (user_id, ebay_cancelled_at)
  WHERE ebay_cancelled_at IS NOT NULL;

-- Returns, as eBay's Post-Order API reports them
-- (GET /post-order/v2/return/search, docs/ebay-reference/post-order/).
-- state / status / reason / reason_type / seller_activity_due hold eBay's raw
-- enumeration values (ReturnStateEnum, ReturnStatusEnum, ReturnReasonEnum,
-- ReturnReasonTypeEnum, ActivityOptionEnum) — the web localizes the ones it
-- knows; an unknown future value is stored, never dropped.
CREATE TABLE IF NOT EXISTS ebay_returns (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebay_account_id          UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  return_id                VARCHAR(40)   NOT NULL,
  ebay_order_id            VARCHAR(60)   NULL,
  order_id                 UUID          NULL REFERENCES orders(id) ON DELETE SET NULL,
  ebay_item_id             VARCHAR(40)   NULL,
  ebay_transaction_id      VARCHAR(40)   NULL,
  return_quantity          INTEGER       NULL,
  state                    VARCHAR(60)   NULL,
  status                   VARCHAR(60)   NULL,
  current_type             VARCHAR(30)   NULL,
  reason                   VARCHAR(60)   NULL,
  reason_type              VARCHAR(30)   NULL,
  buyer_comment            TEXT          NULL,
  buyer_login_name         VARCHAR(120)  NULL,
  seller_activity_due      VARCHAR(60)   NULL,
  seller_respond_by        TIMESTAMPTZ   NULL,
  estimated_refund_amount  NUMERIC(10,2) NULL,
  actual_refund_amount     NUMERIC(10,2) NULL,
  currency                 VARCHAR(3)    NULL,
  escalation_case_id       VARCHAR(40)   NULL,
  created_on_ebay_at       TIMESTAMPTZ   NULL,
  first_seen_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_synced_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (ebay_account_id, return_id)
);

CREATE INDEX IF NOT EXISTS idx_ebay_returns_user_created
  ON ebay_returns (user_id, created_on_ebay_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_returns_order
  ON ebay_returns (order_id) WHERE order_id IS NOT NULL;

-- Claim/watermark for the periodic return sweep (same pattern as
-- last_feed_sync_at, migration 114): claimed and stamped in one statement.
ALTER TABLE ebay_accounts
  ADD COLUMN IF NOT EXISTS last_return_sync_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ebay_accounts_return_sync
  ON ebay_accounts (last_return_sync_at NULLS FIRST)
  WHERE status = 'active';

COMMIT;
