-- 090_tracking_webhook_raw_capture.sql
--
-- Aquiline's OpenAPI document is 3.0.3, which has no `webhooks:` field, so the
-- webhook payload BODY cannot be documented in it at all — only the event
-- names and the signature header are published. `tracking-webhook.controller.ts`
-- was written against the wrong (v3) payload shape and rejects every real
-- Integration API delivery with 400 before it reaches any code that could log
-- it usefully.
--
-- This table exists to answer that gap FROM REAL TRAFFIC rather than a guess:
-- every request whose HMAC signature verifies is captured here VERBATIM,
-- BEFORE any shape assumption is applied. The first real delivery Aquiline
-- sends — even one our current parser rejects — lands here in full, and
-- `SELECT body FROM tracking_webhook_raw_captures ORDER BY received_at DESC
-- LIMIT 1;` is the answer to "what does a real payload look like", no
-- support ticket required.
--
-- Append-only, unbounded retention is deliberate for now — this is a
-- diagnostic capture expected to be read a handful of times while the real
-- receiver (plan 2) is designed, not a permanent log. Add it to
-- data-retention.manifest.ts once its purpose is served.

BEGIN;

CREATE TABLE IF NOT EXISTS tracking_webhook_raw_captures (
  id           BIGSERIAL PRIMARY KEY,
  -- Selected request headers only (content-type + anything Aquiline sends
  -- that looks like an event-type hint), never the full header set — some
  -- headers (cookies, auth) must never be persisted even from a
  -- signature-verified request.
  headers      JSONB       NOT NULL DEFAULT '{}',
  body         TEXT        NOT NULL,
  -- Whether the existing (v3-shaped) parser accepted this body. FALSE is the
  -- expected, useful case — it is what tells us we are looking at a real,
  -- previously-unseen Integration API payload.
  parsed_ok    BOOLEAN     NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_webhook_raw_captures_received
  ON tracking_webhook_raw_captures (received_at DESC);

COMMIT;
