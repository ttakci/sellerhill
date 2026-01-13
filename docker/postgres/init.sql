-- PostgreSQL Initialization Script
-- This script runs when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create ebay_accounts table
CREATE TABLE IF NOT EXISTS ebay_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id VARCHAR(255) NOT NULL,
    marketplace_id VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ebay_accounts
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_user_id ON ebay_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_seller_id ON ebay_accounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_marketplace ON ebay_accounts(marketplace_id);

-- Create unique constraint for seller_id + marketplace_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebay_accounts_unique_seller_marketplace 
    ON ebay_accounts(seller_id, marketplace_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ebay_accounts_updated_at ON ebay_accounts;
CREATE TRIGGER update_ebay_accounts_updated_at
    BEFORE UPDATE ON ebay_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a test user (password: Test123!)
-- Password hash for "Test123!" using bcrypt
INSERT INTO users (first_name, last_name, email, password_hash, email_verified)
VALUES (
    'Test',
    'User',
    'test@example.com',
    '$2b$10$rBV2JDeWW2y0gWvHhfS52eX.8.8bXKQP5FqZFqFvGqKzN5H5H5H5H5',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Create a view for user stats (optional)
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(ea.id) as connected_ebay_accounts,
    u.created_at
FROM users u
LEFT JOIN ebay_accounts ea ON u.id = ea.user_id AND ea.status = 'active'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zonds_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zonds_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO zonds_user;
