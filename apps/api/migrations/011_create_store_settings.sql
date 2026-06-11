CREATE TABLE IF NOT EXISTS store_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID,
    is_global BOOLEAN DEFAULT FALSE,
    country VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    validate_title BOOLEAN DEFAULT TRUE,
    validate_description BOOLEAN DEFAULT FALSE,
    blacklist JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_settings_user_id ON store_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_store_id ON store_settings(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_user_global
    ON store_settings (user_id, is_global)
    WHERE (is_global = TRUE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_user_store
    ON store_settings (user_id, store_id)
    WHERE (store_id IS NOT NULL);
