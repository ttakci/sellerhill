-- 057: Fixed ISP proxy pool with per-user assignment (A2 anti-ban refactor).
--
-- Model change: instead of a single GB-billed rotating-residential provider
-- configured via env (PROXY_ENDPOINT/PROXY_USER/PROXY_PASS_TEMPLATE with a
-- sticky {session} token), the operator buys N fixed ISP proxies (unlimited
-- bandwidth, static IP) and inserts them here. Each USER is assigned exactly
-- one proxy (UNIQUE assigned_user_id) — all of that user's Amazon buyer
-- accounts exit from the same static IP, mirroring the "one household,
-- several accounts" pattern. Assignment is claimed lazily+atomically by
-- ProxyService on first need (FOR UPDATE SKIP LOCKED).
--
-- password: operator may INSERT plaintext; ProxyService.onModuleInit
-- re-encrypts to AES-256-GCM with an 'enc:' prefix on next boot (same
-- pattern as ebay_accounts tokens). The legacy env template remains a
-- fallback when this table is empty.
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(255) NOT NULL,
  -- 'enc:'-prefixed AES-256-GCM after boot backfill; plaintext tolerated on insert.
  password VARCHAR(500) NOT NULL,
  -- ProxyStatus enum in packages/shared: active | disabled
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  label VARCHAR(100),
  assigned_user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fast "claim a free proxy" lookups.
CREATE INDEX IF NOT EXISTS idx_proxies_free
  ON proxies (created_at)
  WHERE assigned_user_id IS NULL AND status = 'active';
