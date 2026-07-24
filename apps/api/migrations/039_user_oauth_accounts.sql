-- Google OAuth (and future providers): passwordless users + identity links.
-- password_hash becomes nullable so Google-only accounts need no local password.
-- user_oauth_accounts is multi-provider-ready; only 'google' is written in this feature.

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user
    ON user_oauth_accounts(user_id);
