-- 059: Runtime platform settings — operator-tunable config without redeploying.
--
-- Model: a code-owned REGISTRY (platform-settings.registry.ts) declares every
-- tunable key with its type, default, validation bounds and the env var it
-- falls back to. This table stores only the OVERRIDES an operator set from the
-- admin panel. Resolution order is: DB row -> env var -> code default. A key
-- with no row here behaves exactly as it did before this migration, so the
-- change is fully backwards compatible and a row can always be deleted to
-- return to the env/default behavior.
--
-- Deliberately NOT stored here (they stay env-only): connection bootstrap
-- (DATABASE_*, REDIS_*), crypto/auth secrets (JWT_*, AMAZON_ENCRYPTION_KEY),
-- provider API credentials (KEEPA_API_KEY, EBAY_*, GOOGLE_*, PADDLE_*,
-- LLM_API_KEY) and process identity (NODE_ENV, PORT, CORS_ORIGINS). Those are
-- needed before the DB connection exists, are rotated as an ops action, and
-- must not be reachable through an HTTP surface.
--
-- `value` is the canonical STRING form of the setting (same shape an env var
-- would carry); the registry coerces it to boolean/number/enum and validates
-- it on both write and read. Secret-flagged registry keys are stored
-- 'enc:'-prefixed (AES-256-GCM) and are never returned by any read endpoint.
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  -- Operator who last changed it (audit trail lives in audit_logs too).
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
