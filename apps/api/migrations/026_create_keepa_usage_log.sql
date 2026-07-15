-- Per-ASIN Keepa token spend log. Fair-split attribution: each ASIN's token cost is
-- divided by the number of users actively listing it (stored in user_ids JSONB array).
-- Append-only (no updated_at trigger needed).
CREATE TABLE IF NOT EXISTS keepa_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asin VARCHAR(10) NOT NULL,
    tokens DECIMAL(10,3) NOT NULL,
    source VARCHAR(20) NOT NULL,
    user_ids JSONB NOT NULL DEFAULT '[]',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keepa_usage_asin ON keepa_usage_log(asin);
CREATE INDEX IF NOT EXISTS idx_keepa_usage_requested_at ON keepa_usage_log(requested_at DESC);

-- Admin: per-user monthly Keepa token cost (fair-split).
-- SELECT uid AS user_id,
--        SUM(tokens / jsonb_array_length(user_ids)) AS tokens
-- FROM keepa_usage_log
-- CROSS JOIN LATERAL jsonb_array_elements_text(user_ids) AS uid
-- WHERE requested_at >= date_trunc('month', NOW())
-- GROUP BY uid
-- ORDER BY tokens DESC;
