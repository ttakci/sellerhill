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

CREATE INDEX IF NOT EXISTS idx_ebay_accounts_user_id ON ebay_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_seller_id ON ebay_accounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_marketplace ON ebay_accounts(marketplace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebay_accounts_unique_seller_marketplace
    ON ebay_accounts(seller_id, marketplace_id);
