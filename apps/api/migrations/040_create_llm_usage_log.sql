-- Append-only LLM call log for future per-user cost attribution (mirrors keepa_usage_log).
-- No aggregation/billing UI in Spec B — data only.
CREATE TABLE IF NOT EXISTS llm_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    purpose VARCHAR(20) NOT NULL,
    model VARCHAR(120) NOT NULL,
    prompt_tokens INTEGER NULL,
    completion_tokens INTEGER NULL,
    latency_ms INTEGER NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error VARCHAR(200) NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_requested_at ON llm_usage_log(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON llm_usage_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_purpose ON llm_usage_log(purpose);

-- Admin: per-user monthly LLM calls (when user_id present).
-- SELECT user_id,
--        COUNT(*) FILTER (WHERE success) AS ok_calls,
--        COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
--        COALESCE(SUM(completion_tokens), 0) AS completion_tokens
-- FROM llm_usage_log
-- WHERE requested_at >= date_trunc('month', NOW())
-- GROUP BY user_id
-- ORDER BY ok_calls DESC;
