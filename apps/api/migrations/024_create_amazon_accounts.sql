-- Amazon buyer accounts for order scraping and tracking
CREATE TABLE IF NOT EXISTS amazon_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    two_factor_secret TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_verified_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_amazon_accounts_user_id ON amazon_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_amazon_accounts_status ON amazon_accounts(status);

-- Add Amazon order tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amazon_account_id UUID REFERENCES amazon_accounts(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amazon_order_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amazon_tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amazon_tracking_carrier VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amazon_linked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_amazon_account_id ON orders(amazon_account_id);
CREATE INDEX IF NOT EXISTS idx_orders_amazon_order_id ON orders(amazon_order_id) WHERE amazon_order_id IS NOT NULL;
