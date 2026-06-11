CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asin VARCHAR(10) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price JSONB NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    image_urls JSONB NOT NULL,
    brand VARCHAR(200),
    category VARCHAR(200),
    features JSONB,
    raw_provider_data JSONB,
    raw_keepa_data JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    stock INT DEFAULT 0,
    last_repriced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_asin ON products(asin);
CREATE INDEX IF NOT EXISTS idx_products_last_sync ON products(last_sync_at);
