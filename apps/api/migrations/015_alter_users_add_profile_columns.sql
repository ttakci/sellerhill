-- Add profile columns (for existing databases where 001_create_users ran without these)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city_state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Drop deprecated columns
ALTER TABLE users DROP COLUMN IF EXISTS tax_id;
ALTER TABLE users DROP COLUMN IF EXISTS social_links;
