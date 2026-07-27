-- Migration 049: Admin Observability & FinOps foundation.
--
-- Adds three independent, append-only/read-only primitives that the admin
-- module (apps/api/src/modules/admin) reads from:
--
--   1. usage_events — append-only metering stream across providers (Keepa, LLM,
--      Amazon, eBay). The admin overview/usage summaries aggregate this.
--   2. shared_cost_entries — platform-level shared costs with effective dates
--      (e.g. residential proxy subscription) for FinOps attribution.
--
-- This migration is intentionally additive only. User roles are owned by
-- migration 041 and LLM model pricing is owned by migration 048.

-- =============================================================================
-- 1. usage_events — append-only metering stream
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE usage_event_source AS ENUM ('keepa', 'llm', 'amazon', 'ebay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE usage_metric AS ENUM (
    'keepa_tokens',
    'llm_prompt_tokens',
    'llm_completion_tokens',
    'llm_embedding_tokens',
    'amazon_browser_actions',
    'ebay_api_calls'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- NULL tenant = platform-level shared usage (e.g. a Keepa token pool draw
  -- not yet attributed, or a shared-cost-only event).
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source usage_event_source NOT NULL,
  metric usage_metric NOT NULL,
  quantity BIGINT NOT NULL CHECK (quantity >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional cross-reference to the originating row in the source system
  -- (e.g. llm_usage_log.id, keepa_usage_log.id). Loose coupling — no FK so a
  -- source-table cleanup never blocks the observability stream.
  provider_ref_id VARCHAR(200),
  -- Micro-USD estimated cost attributed at write time (1/1,000,000 USD).
  -- NULL = cost unknown (never faked as 0). Pair-coupled with currency.
  estimated_cost_micros BIGINT CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  currency CHAR(3),
  -- Pair constraint: cost and currency must both be present or both absent.
  CONSTRAINT usage_events_cost_currency_pair CHECK (
    (estimated_cost_micros IS NULL AND currency IS NULL) OR
    (estimated_cost_micros IS NOT NULL AND currency IS NOT NULL)
  )
);

-- Hot read path: admin overview/summaries filter by (source, recorded_at).
CREATE INDEX IF NOT EXISTS idx_usage_events_source_recorded
  ON usage_events(source, recorded_at DESC);

-- Per-tenant attribution queries (e.g. monthly cost per user).
CREATE INDEX IF NOT EXISTS idx_usage_events_user_recorded
  ON usage_events(user_id, recorded_at DESC)
  WHERE user_id IS NOT NULL;

-- (source, metric) aggregation — the canonical grouping for usage summaries.
CREATE INDEX IF NOT EXISTS idx_usage_events_source_metric_recorded
  ON usage_events(source, metric, recorded_at DESC);

-- Cost-only queries (admin cost dashboard).
CREATE INDEX IF NOT EXISTS idx_usage_events_cost
  ON usage_events(recorded_at DESC, estimated_cost_micros)
  WHERE estimated_cost_micros IS NOT NULL;

-- =============================================================================
-- 2. shared_cost_entries — platform-level shared costs with effective dates
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE shared_cost_allocation_method AS ENUM ('even_split', 'usage_weighted', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS shared_cost_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label VARCHAR(300) NOT NULL,
  allocation_method shared_cost_allocation_method NOT NULL,
  -- Micro-USD total (1/1,000,000 USD). Always positive — a zero-cost shared
  -- entry has no attribution value and should not be stored.
  total_cost_micros BIGINT NOT NULL CHECK (total_cost_micros > 0),
  currency CHAR(3) NOT NULL,
  -- Effective window. effective_from is inclusive; effective_to is exclusive
  -- and NULL means open-ended (current). At most one open-ended row per
  -- (label, currency) is enforced by the partial unique index below.
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- At most one open-ended entry per (label, currency).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_cost_open
  ON shared_cost_entries(label, currency)
  WHERE effective_to IS NULL;

-- Range queries by effective window (FinOps resolver picks the row covering a
-- given instant).
CREATE INDEX IF NOT EXISTS idx_shared_cost_effective
  ON shared_cost_entries(label, currency, effective_from DESC, effective_to);

-- Chronicle queries (admin lists all entries).
CREATE INDEX IF NOT EXISTS idx_shared_cost_created
  ON shared_cost_entries(created_at DESC);
