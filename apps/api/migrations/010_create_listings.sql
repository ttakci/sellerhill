CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asin VARCHAR(10) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    listing_settings_group_id UUID NOT NULL REFERENCES listing_settings_groups(id),
    ebay_item_id VARCHAR(50) UNIQUE NOT NULL,
    payment_policy_id VARCHAR(50),
    shipping_policy_id VARCHAR(50),
    return_policy_id VARCHAR(50),
    title TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2),
    estimated_profit DECIMAL(10,2),
    profit_margin DECIMAL(10,2),
    roi DECIMAL(10,2),
    sold_count INT DEFAULT 0,
    watch_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    ebay_category_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);
