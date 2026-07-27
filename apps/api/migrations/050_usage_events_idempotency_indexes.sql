-- Migration 050: Idempotency indexes for usage_events (projection safe-replay).
--
-- The usage_events table (migration 049) is the append-only FinOps ledger.
-- Projections from keepa_usage_log / llm_usage_log feed it; re-projecting the
-- same source row MUST be a no-op so the backfill service can run repeatedly
-- without duplicating rows. The natural idempotency key is
-- (source, metric, provider_ref_id, user_id).
--
-- Two partial unique indexes enforce this:
--   - user-attributed events (user_id IS NOT NULL): one row per
--     (source, metric, provider_ref_id, user_id).
--   - platform-level events (user_id IS NULL): one row per
--     (source, metric, provider_ref_id). A plain UNIQUE would NOT enforce the
--     platform-level case because SQL NULLs are distinct values.
--
-- A re-projection hits the appropriate index and raises unique-violation
-- (23505); UsageEventsService catches it and reports `idempotentSkip`.
--
-- NOTE: source/metric are PG enum columns (usage_event_source / usage_metric),
-- created in migration 049. The proxy/tracking enum values added to the shared
-- UsageEventSource/UsageMetric TypeScript enums are forward-compatible seams
-- only — no row is written for them in this iteration, so the DB enum does not
-- need ALTERing here. When a real proxy/tracking measurement point is wired, a
-- future migration will ALTER TYPE ... ADD VALUE for the new enum members.

-- Idempotency for user-attributed events.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_events_user_ref
  ON usage_events (source, metric, provider_ref_id, user_id)
  WHERE user_id IS NOT NULL;

-- Idempotency for platform-level events (user_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_events_platform_ref
  ON usage_events (source, metric, provider_ref_id)
  WHERE user_id IS NULL;
