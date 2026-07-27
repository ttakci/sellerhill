DO $$ BEGIN CREATE TYPE assistant_limiter_readiness AS ENUM ('not_ready','rebuilding','ready','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_reservation_status AS ENUM ('pending','reserved','reconciled','released','expired','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_lease_status AS ENUM ('active','released','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_reconcile_status AS ENUM ('pending','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_quota_scope AS ENUM ('user','provider'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assistant_limiter_state (
 scope_key VARCHAR(300) PRIMARY KEY, readiness assistant_limiter_readiness NOT NULL DEFAULT 'not_ready', version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 checkpoint_at TIMESTAMPTZ, checkpoint_value BIGINT NOT NULL DEFAULT 0 CHECK(checkpoint_value>=0), error_code VARCHAR(100), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assistant_quota_ledger (
 id BIGSERIAL PRIMARY KEY, scope assistant_quota_scope NOT NULL, user_id UUID REFERENCES users(id) ON DELETE CASCADE, provider VARCHAR(100),
 window_start TIMESTAMPTZ NOT NULL, window_end TIMESTAMPTZ NOT NULL, token_limit BIGINT NOT NULL CHECK(token_limit>=0), reserved_tokens BIGINT NOT NULL DEFAULT 0 CHECK(reserved_tokens>=0),
 actual_tokens BIGINT NOT NULL DEFAULT 0 CHECK(actual_tokens>=0), version BIGINT NOT NULL DEFAULT 1 CHECK(version>0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(window_end>window_start), CHECK((scope='user' AND user_id IS NOT NULL AND provider IS NULL) OR (scope='provider' AND provider IS NOT NULL AND user_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quota_ledger_user_window ON assistant_quota_ledger(user_id,window_start,window_end) WHERE scope='user';
CREATE UNIQUE INDEX IF NOT EXISTS uq_quota_ledger_provider_window ON assistant_quota_ledger(provider,window_start,window_end) WHERE scope='provider';
CREATE TABLE IF NOT EXISTS assistant_quota_reservations (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), generation_attempt_id UUID NOT NULL REFERENCES assistant_generation_attempts(id) ON DELETE CASCADE, scope assistant_quota_scope NOT NULL,
 ledger_id BIGINT NOT NULL REFERENCES assistant_quota_ledger(id) ON DELETE RESTRICT, source_key VARCHAR(200) NOT NULL, estimated_prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK(estimated_prompt_tokens>=0),
 estimated_completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK(estimated_completion_tokens>=0), estimated_embedding_tokens INTEGER NOT NULL DEFAULT 0 CHECK(estimated_embedding_tokens>=0),
 reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens>=0), actual_tokens INTEGER CHECK(actual_tokens IS NULL OR actual_tokens>=0), status assistant_reservation_status NOT NULL DEFAULT 'pending',
 expires_at TIMESTAMPTZ NOT NULL, reconciled_at TIMESTAMPTZ, released_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(generation_attempt_id,scope,source_key,ledger_id), CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS idx_quota_reservations_expiry ON assistant_quota_reservations(expires_at) WHERE status IN ('pending','reserved');
CREATE TABLE IF NOT EXISTS assistant_concurrency_leases (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), generation_attempt_id UUID NOT NULL REFERENCES assistant_generation_attempts(id) ON DELETE CASCADE,
 scope_key VARCHAR(300) NOT NULL, owner_id UUID NOT NULL, status assistant_lease_status NOT NULL DEFAULT 'active', acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
 released_at TIMESTAMPTZ, UNIQUE(generation_attempt_id,scope_key), CHECK(expires_at>acquired_at)
);
CREATE INDEX IF NOT EXISTS idx_concurrency_leases_active ON assistant_concurrency_leases(scope_key,expires_at) WHERE status='active';
CREATE TABLE IF NOT EXISTS assistant_quota_reconciliations (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), generation_attempt_id UUID NOT NULL REFERENCES assistant_generation_attempts(id) ON DELETE CASCADE,
 reservation_id UUID NOT NULL REFERENCES assistant_quota_reservations(id) ON DELETE CASCADE, source_key VARCHAR(200) NOT NULL, window_start TIMESTAMPTZ NOT NULL, window_end TIMESTAMPTZ NOT NULL,
 reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens>=0), actual_tokens INTEGER NOT NULL CHECK(actual_tokens>=0), delta_tokens INTEGER NOT NULL,
 status assistant_reconcile_status NOT NULL DEFAULT 'pending', error_code VARCHAR(100), completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(generation_attempt_id,reservation_id,source_key,window_start,window_end), CHECK(window_end>window_start)
);
