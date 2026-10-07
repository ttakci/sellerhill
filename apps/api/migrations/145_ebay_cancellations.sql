-- 145: eBay buyer cancellation requests, as the Post-Order API reports them
-- (GET /post-order/v2/cancellation/search?role=BUYER,
-- docs/ebay-reference/post-order/post-order_v2_cancellation_search__get.txt).
--
-- state / status / reason / close_reason hold eBay's raw CancelStateEnum,
-- CancelStatusEnum, CancelReasonEnum and CancelCloseReasonEnum values — none
-- of those value pages is in the local reference, so they are stored as sent
-- and nothing depends on a value list. The bucket is derived from closed_at,
-- requestor_type and seller_respond_by (cancellation-bucket.ts).
--
-- order_id links legacy_order_id to orders.ebay_order_id for the same user and
-- store. UNVERIFIED that the two ids are the same string — settled by the first
-- live request; an unlinked row is still listed and counted.
BEGIN;

CREATE TABLE IF NOT EXISTS ebay_cancellations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebay_account_id          UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  cancel_id                VARCHAR(40)   NOT NULL,
  legacy_order_id          VARCHAR(60)   NULL,
  order_id                 UUID          NULL REFERENCES orders(id) ON DELETE SET NULL,
  marketplace_id           VARCHAR(20)   NULL,
  requestor_type           VARCHAR(20)   NULL,
  state                    VARCHAR(60)   NULL,
  status                   VARCHAR(60)   NULL,
  reason                   VARCHAR(60)   NULL,
  close_reason             VARCHAR(60)   NULL,
  buyer_login_name         VARCHAR(120)  NULL,
  requested_at             TIMESTAMPTZ   NULL,
  seller_respond_by        TIMESTAMPTZ   NULL,
  buyer_respond_by         TIMESTAMPTZ   NULL,
  closed_at                TIMESTAMPTZ   NULL,
  requested_refund_amount  NUMERIC(10,2) NULL,
  currency                 VARCHAR(3)    NULL,
  payment_status           VARCHAR(40)   NULL,
  -- eBay account-deletion erasure marker (same rule as migration 130).
  buyer_data_erased_at     TIMESTAMPTZ   NULL,
  first_seen_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_synced_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (ebay_account_id, cancel_id)
);

CREATE INDEX IF NOT EXISTS idx_ebay_cancellations_user_requested
  ON ebay_cancellations (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_cancellations_order
  ON ebay_cancellations (order_id) WHERE order_id IS NOT NULL;

-- Claim/watermark for the cancellation sweep (same pattern as
-- last_return_sync_at, migration 128).
ALTER TABLE ebay_accounts
  ADD COLUMN IF NOT EXISTS last_cancellation_sync_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ebay_accounts_cancellation_sync
  ON ebay_accounts (last_cancellation_sync_at NULLS FIRST)
  WHERE status = 'active';

COMMIT;
