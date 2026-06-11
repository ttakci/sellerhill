CREATE TABLE IF NOT EXISTS listing_settings_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    repricing_strategy JSONB NOT NULL,
    stock JSONB NOT NULL,
    fees JSONB NOT NULL,
    templates JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_settings_groups_user_id ON listing_settings_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_settings_groups_created_by ON listing_settings_groups(created_by);

-- Fix schema mismatch: Drop store_id if it exists in legacy databases
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_settings_groups' AND column_name='store_id') THEN
    ALTER TABLE listing_settings_groups DROP COLUMN store_id;
  END IF;
END $$;
