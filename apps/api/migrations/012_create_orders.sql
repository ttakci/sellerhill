CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
    ebay_order_id VARCHAR(50) NOT NULL UNIQUE,
    buyer_username VARCHAR(255),
    buyer_name VARCHAR(255),
    buyer_email VARCHAR(255),
    buyer_phone VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    order_fulfillment_status VARCHAR(30),
    payment_status VARCHAR(30),
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    quantity INT DEFAULT 1,
    sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    sale_shipping DECIMAL(12,2) DEFAULT 0,
    sale_tax DECIMAL(12,2) DEFAULT 0,
    sale_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    ebay_earnings DECIMAL(12,2) DEFAULT 0,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    amazon_tax DECIMAL(12,2) DEFAULT 0,
    amazon_shipping DECIMAL(12,2) DEFAULT 0,
    amazon_order_url TEXT,
    amazon_tracking_url TEXT,
    transaction_fee DECIMAL(12,2) DEFAULT 0,
    ad_fee DECIMAL(12,2) DEFAULT 0,
    net_profit DECIMAL(12,2) DEFAULT 0,
    shipping_address JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    order_date TIMESTAMP WITH TIME ZONE,
    last_ebay_event_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_ebay_order_id ON orders(ebay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_ebay_account_id ON orders(ebay_account_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON orders(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date DESC);
