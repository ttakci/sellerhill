-- 125: eBay Messages — messaging scopes on the store row, unread counter,
-- NEW_MESSAGE subscription bookkeeping, notification destination + inbox.
-- See docs/superpowers/specs/2026-09-29-ebay-messages-design.md.
BEGIN;

ALTER TABLE ebay_accounts
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unread_message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_message_synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS message_subscription_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS message_subscription_at TIMESTAMPTZ NULL;

-- One row per (environment, endpoint). The destination is APPLICATION-level on
-- eBay's side (one for all sellers); we keep the id eBay minted so a restart
-- never re-creates it.
CREATE TABLE IF NOT EXISTS ebay_notification_destinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment     VARCHAR(20)  NOT NULL,
  endpoint_url    TEXT         NOT NULL,
  destination_id  VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (environment, endpoint_url)
);

-- Every signature-verified delivery, once. notification_id is eBay's own id and
-- is what makes a retried delivery (same id, higher publishAttemptCount) a
-- no-op instead of a second unread increment.
CREATE TABLE IF NOT EXISTS ebay_notification_events (
  id                BIGSERIAL PRIMARY KEY,
  notification_id   VARCHAR(120) NOT NULL UNIQUE,
  topic             VARCHAR(60)  NOT NULL,
  ebay_account_id   UUID NULL REFERENCES ebay_accounts(id) ON DELETE SET NULL,
  conversation_id   VARCHAR(120) NULL,
  conversation_type VARCHAR(20)  NULL,
  outcome           VARCHAR(30)  NOT NULL,
  payload           JSONB        NOT NULL,
  event_at          TIMESTAMPTZ  NULL,
  received_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_events_received ON ebay_notification_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_events_account ON ebay_notification_events (ebay_account_id, received_at DESC);

-- Verbatim capture of every POST that reaches the receiver, before any decision
-- (same role as tracking_webhook_raw_captures, migration 090): a future shape
-- change shows up as parsed_ok = false / signature_ok = false, not as silence.
CREATE TABLE IF NOT EXISTS ebay_notification_raw_captures (
  id            BIGSERIAL PRIMARY KEY,
  headers       JSONB       NOT NULL DEFAULT '{}',
  body          TEXT        NOT NULL,
  signature_ok  BOOLEAN     NOT NULL,
  parsed_ok     BOOLEAN     NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_raw_captures_received ON ebay_notification_raw_captures (received_at DESC);

COMMIT;
