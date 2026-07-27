-- Migration 051: Queue observability — append-only job terminal-event capture.
--
-- Adds the `queue_observations` table and the `queue_event_type` enum. One row
-- per captured BullMQ job terminal event (completed/failed), written by
-- QueueObservabilityService (fail-soft, idempotent).
--
-- INVARIANT: the job payload is NEVER stored. Only:
--   - `payload_hash` — SHA-256 hex of an allowlisted subset of job-data fields
--     (correlationId, causationJobId, asin, ebayOrderId, amazonAccountId,
--     productId, userId, listingSettingsGroupId). See
--     PAYLOAD_HASH_ALLOWLIST in packages/shared. The raw payload is redacted
--     away before hashing and never reaches this table.
--   - `correlation_id` — the allowlisted correlation id, the sole job-data
--     field stored verbatim (so admins can filter/group observations by
--     correlation without re-hashing).
--
-- Idempotency: the partial unique index `uq_queue_observations_job_event`
-- enforces one row per (queue_name, job_id, event). A repeated BullMQ event
-- for the same job+event raises 23505 and is reported as `idempotentSkip` by
-- QueueObservabilityService.record() — never a duplicate.
--
-- Retention is code-enforced (QueueObservabilityRetentionService daily purge),
-- not a DB TTL, so the retention window (QUEUE_OBSERVABILITY_RETENTION_DAYS,
-- default 7, clamp 1–90) is tunable without a migration.

DO $$ BEGIN
  CREATE TYPE queue_event_type AS ENUM ('completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS queue_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- BullMQ queue name (e.g. 'order-sync', 'auto-fulfill').
  queue_name VARCHAR(80) NOT NULL,
  -- BullMQ job id.
  job_id VARCHAR(160) NOT NULL,
  -- Terminal event kind.
  event queue_event_type NOT NULL,
  -- Allowlisted correlation id (from job.data.correlationId). NULL when the
  -- producer did not stamp one (e.g. legacy / scheduled jobs).
  correlation_id VARCHAR(120),
  -- BullMQ job name (first arg to queue.add(name, ...)); NULL when omitted.
  job_name VARCHAR(160),
  -- Attempts made before this terminal event (BullMQ attemptsMade).
  attempts SMALLINT NOT NULL DEFAULT 0
    CHECK (attempts >= 0),
  -- Wall-clock duration ms from enqueue to terminal; NULL when unknown.
  duration_ms INTEGER
    CHECK (duration_ms IS NULL OR duration_ms >= 0),
  -- Error message for 'failed' events; NULL for 'completed'.
  error_message TEXT,
  -- SHA-256 hex of the allowlisted payload subset; NULL when the allowlist
  -- yielded nothing (no payload signal). The raw payload is NEVER stored.
  payload_hash CHAR(64),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: one row per (queue_name, job_id, event). A repeated event for
-- the same job+event is an idempotent skip, never a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_observations_job_event
  ON queue_observations(queue_name, job_id, event);

-- Hot read path: admin list endpoint filters by (queue_name, recorded_at).
CREATE INDEX IF NOT EXISTS idx_queue_observations_queue_recorded
  ON queue_observations(queue_name, recorded_at DESC);

-- Correlation drill-down: filter/group by correlation_id.
CREATE INDEX IF NOT EXISTS idx_queue_observations_correlation
  ON queue_observations(correlation_id, recorded_at DESC)
  WHERE correlation_id IS NOT NULL;

-- Failure surface: admin "recent failures" view.
CREATE INDEX IF NOT EXISTS idx_queue_observations_failed
  ON queue_observations(recorded_at DESC)
  WHERE event = 'failed';

-- Retention purge: delete rows older than N days. Index on recorded_at
-- supports the range scan; the partial failed index above is a subset.
CREATE INDEX IF NOT EXISTS idx_queue_observations_recorded
  ON queue_observations(recorded_at);
