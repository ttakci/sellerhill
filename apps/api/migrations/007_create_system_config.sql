CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(200),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_config (key, value, description)
VALUES ('product_sync_interval_days', '7', 'Days between product data syncs')
ON CONFLICT (key) DO NOTHING;
