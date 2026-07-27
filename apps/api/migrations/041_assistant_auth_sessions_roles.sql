DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'support', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_availability AS ENUM ('offline', 'online_available', 'online_unavailable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version > 0);

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_hash CHAR(64) NOT NULL,
  session_version INTEGER NOT NULL CHECK (session_version > 0),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID REFERENCES auth_refresh_sessions(id),
  reuse_detected_at TIMESTAMPTZ,
  CONSTRAINT auth_refresh_sessions_expiry CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_user_active
  ON auth_refresh_sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_refresh_sessions_family
  ON auth_refresh_sessions(family_id);

CREATE TABLE IF NOT EXISTS support_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  availability support_availability NOT NULL DEFAULT 'offline',
  capacity INTEGER NOT NULL DEFAULT 5 CHECK (capacity BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION revoke_auth_sessions_on_user_security_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.session_version := OLD.session_version + 1;
    UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE user_id = OLD.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_security_change_revoke_sessions ON users;
CREATE TRIGGER users_security_change_revoke_sessions
BEFORE UPDATE OF role, status ON users
FOR EACH ROW EXECUTE FUNCTION revoke_auth_sessions_on_user_security_change();
