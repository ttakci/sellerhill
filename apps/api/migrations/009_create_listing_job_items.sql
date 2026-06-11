CREATE TABLE IF NOT EXISTS listing_job_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES listing_jobs(id) ON DELETE CASCADE,
    asin VARCHAR(10) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    listing_id UUID,
    status VARCHAR(20) DEFAULT 'DRAFT',
    ebay_item_id VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listing_job_items_job_id ON listing_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_listing_job_items_asin ON listing_job_items(asin);
