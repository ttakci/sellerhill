-- apps/api/migrations/054_buyer_messaging.sql
BEGIN;

CREATE TYPE buyer_message_event_type AS ENUM (
  'order_received',
  'shipped',
  'delivered',
  'feedback_request'
);

CREATE TYPE buyer_message_status AS ENUM (
  'sent',
  'failed',
  'skipped'
);

-- per-store-settings config (global + per-store rows already exist on store_settings)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS buyer_messaging JSONB;

CREATE TABLE IF NOT EXISTS buyer_message_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    buyer_message_event_type NOT NULL,
  name          VARCHAR(120) NOT NULL,
  body          TEXT NOT NULL,
  locale        VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_buyer_msg_templates_user_event
  ON buyer_message_templates(user_id, event_type);

CREATE TABLE IF NOT EXISTS buyer_message_log (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebay_account_id     UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  ebay_order_id       VARCHAR(64) NOT NULL,
  event_type          buyer_message_event_type NOT NULL,
  template_kind       VARCHAR(16) NOT NULL,
  template_ref        VARCHAR(160) NOT NULL,
  status              buyer_message_status NOT NULL,
  error               VARCHAR(500),
  provider_message_id VARCHAR(160),
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_msg_log_sent
  ON buyer_message_log(ebay_order_id, event_type)
  WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_buyer_msg_log_order
  ON buyer_message_log(ebay_order_id);
CREATE INDEX IF NOT EXISTS idx_buyer_msg_log_user_event
  ON buyer_message_log(user_id, event_type, created_at DESC);

COMMIT;
