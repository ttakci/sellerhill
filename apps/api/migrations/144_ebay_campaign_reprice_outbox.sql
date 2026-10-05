-- Commit ad-rate changes and their repricing requests in the same transaction.
-- A global sequence prevents an old delivery acknowledgement from matching a
-- newer row after another consumer deleted and a concurrent writer recreated it.
CREATE TABLE IF NOT EXISTS ebay_campaign_reprice_outbox (
  ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  revision BIGSERIAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ebay_account_id, product_id)
);
