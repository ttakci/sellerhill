-- 091_tracking_webhook_real_shape.sql
--
-- Aquiline confirmed the real webhook payload shape on 2026-08-26. It does not
-- match what migration `075` assumed, in one way that the schema itself
-- enforces:
--
--   `tracking_webhook_events.tracking_number` is NOT NULL, but a real payload
--   NEVER carries a tracking number. The provider states plainly that the
--   `AQUA…YQ` number is not included in webhook payloads — it has to be read
--   back from `GET /v1/profiles/{profileId}/orders/{orderId}`. Every genuine
--   delivery would therefore fail to insert.
--
-- What a payload DOES always carry is `profileId` + `orderId`, where `orderId`
-- is the marketplace order id (the Amazon order id we sent to `upsertOrders`).
-- Those become the join key and the idempotency key.
--
-- The old `075` columns are kept rather than dropped: rows written under the
-- previous shape (there are none in practice — the receiver rejected every
-- real payload — but a deployment may differ) stay readable, and the standing
-- practice in this repo is to leave applied-migration artifacts dormant rather
-- than remove them.

BEGIN;

ALTER TABLE tracking_webhook_events
    -- No longer required: a real payload has no tracking number at all.
    ALTER COLUMN tracking_number DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS profile_id           VARCHAR(128),
    -- The provider's `data.orderId` — a marketplace order id, NOT our UUID.
    -- Named explicitly so it is never confused with `order_id`, which is the
    -- FK to our own `orders.id` two columns below.
    ADD COLUMN IF NOT EXISTS marketplace_order_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS problem_code         VARCHAR(64),
    ADD COLUMN IF NOT EXISTS outcome_detail       VARCHAR(32);

-- Idempotency: one APPLIED row per (profile, marketplace order, event,
-- occurrence). The provider retries 4 times (1s/5s/20s), so the same event
-- WILL arrive more than once; this index is what makes the second arrival a
-- no-op instead of a repeated side effect.
--
-- Partial on 'applied' for the same reason `075`'s index was: retries,
-- unmatched deliveries and ignored events are all still recorded for support,
-- and must not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_webhook_applied_order
    ON tracking_webhook_events (provider, profile_id, marketplace_order_id, event_type, occurred_at)
    WHERE outcome = 'applied';

-- Support lookup: "what did the provider tell us about this order?"
CREATE INDEX IF NOT EXISTS idx_tracking_webhook_marketplace_order
    ON tracking_webhook_events (marketplace_order_id, received_at DESC);

COMMIT;
