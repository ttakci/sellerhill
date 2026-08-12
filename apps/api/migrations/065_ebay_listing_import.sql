CREATE TYPE ebay_listing_tracking_state AS ENUM ('untracked', 'tracked');
CREATE TYPE ebay_listing_api_model AS ENUM ('legacy', 'inventory', 'unknown');

CREATE TABLE ebay_listing_discoveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
    ebay_item_id VARCHAR(50) NOT NULL,
    sku VARCHAR(100),
    title TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    quantity_sold INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    marketplace_id VARCHAR(30) NOT NULL,
    api_model ebay_listing_api_model NOT NULL DEFAULT 'unknown',
    tracking_state ebay_listing_tracking_state NOT NULL DEFAULT 'untracked',
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    UNIQUE (ebay_account_id, ebay_item_id)
);

CREATE INDEX idx_ebay_listing_discoveries_user_tracking
    ON ebay_listing_discoveries(user_id, tracking_state, last_seen_at DESC);
CREATE INDEX idx_ebay_listing_discoveries_item
    ON ebay_listing_discoveries(user_id, ebay_item_id);

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS imported_from_ebay BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TYPE listing_job_kind AS ENUM ('create', 'existing_import');
ALTER TABLE listing_jobs
    ADD COLUMN IF NOT EXISTS kind listing_job_kind NOT NULL DEFAULT 'create',
    ADD COLUMN IF NOT EXISTS ebay_account_id UUID REFERENCES ebay_accounts(id) ON DELETE SET NULL;
ALTER TABLE listing_job_items
    ADD COLUMN IF NOT EXISTS source_row INTEGER,
    ADD COLUMN IF NOT EXISTS source_ebay_item_id VARCHAR(50);

COMMENT ON TABLE ebay_listing_discoveries IS
    'Read-only mirror of active eBay listings not yet managed by SellerHill; import promotes a row into listings.';
