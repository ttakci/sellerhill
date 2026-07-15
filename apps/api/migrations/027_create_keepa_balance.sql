-- Keepa shared token balance snapshots (time series). Captured from the top-level
-- tokensLeft/refillIn fields of each /product response. Used to monitor plan-tier
-- utilization and inform refresh-frequency / plan decisions.
CREATE TABLE IF NOT EXISTS keepa_balance (
    id SERIAL PRIMARY KEY,
    tokens_left INT NOT NULL,
    refill_in_ms BIGINT,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keepa_balance_captured_at ON keepa_balance(captured_at DESC);
