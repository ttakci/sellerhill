DO $$ BEGIN CREATE TYPE llm_usage_source AS ENUM ('provider','estimated','mixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE llm_usage_log
 ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES assistant_messages(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS generation_attempt_id UUID REFERENCES assistant_generation_attempts(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS provider VARCHAR(100), ADD COLUMN IF NOT EXISTS usage_source llm_usage_source,
 ADD COLUMN IF NOT EXISTS provider_request_id VARCHAR(200), ADD COLUMN IF NOT EXISTS embedding_tokens INTEGER,
 ADD COLUMN IF NOT EXISTS reservation_tokens INTEGER, ADD COLUMN IF NOT EXISTS estimated_cost_micros BIGINT,
 ADD COLUMN IF NOT EXISTS currency CHAR(3), ADD COLUMN IF NOT EXISTS pricing_id UUID,
 ADD CONSTRAINT llm_usage_embedding_tokens_nonnegative CHECK(embedding_tokens IS NULL OR embedding_tokens>=0),
 ADD CONSTRAINT llm_usage_reservation_tokens_nonnegative CHECK(reservation_tokens IS NULL OR reservation_tokens>=0),
 ADD CONSTRAINT llm_usage_cost_nonnegative CHECK(estimated_cost_micros IS NULL OR estimated_cost_micros>=0),
 ADD CONSTRAINT llm_usage_currency_cost_pair CHECK((estimated_cost_micros IS NULL AND currency IS NULL) OR (estimated_cost_micros IS NOT NULL AND currency IS NOT NULL));

CREATE TABLE IF NOT EXISTS llm_model_pricing (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), provider VARCHAR(100) NOT NULL, model VARCHAR(200) NOT NULL,
 input_cost_per_million_micros BIGINT NOT NULL CHECK(input_cost_per_million_micros>=0), output_cost_per_million_micros BIGINT NOT NULL CHECK(output_cost_per_million_micros>=0),
 embedding_cost_per_million_micros BIGINT NOT NULL CHECK(embedding_cost_per_million_micros>=0), currency CHAR(3) NOT NULL,
 effective_from TIMESTAMPTZ NOT NULL, effective_to TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(effective_to IS NULL OR effective_to>effective_from), UNIQUE(provider,model,effective_from)
);
ALTER TABLE llm_usage_log ADD CONSTRAINT fk_llm_usage_pricing FOREIGN KEY(pricing_id) REFERENCES llm_model_pricing(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_model_pricing_open ON llm_model_pricing(provider,model,currency) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_llm_model_pricing_effective ON llm_model_pricing(provider,model,effective_from DESC,effective_to);
CREATE INDEX IF NOT EXISTS idx_llm_usage_generation ON llm_usage_log(generation_attempt_id) WHERE generation_attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_conversation ON llm_usage_log(conversation_id,requested_at DESC) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_daily ON llm_usage_log(tenant_id,requested_at DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_model ON llm_usage_log(provider,model,requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_cost ON llm_usage_log(requested_at DESC,estimated_cost_micros) WHERE estimated_cost_micros IS NOT NULL;
ALTER TABLE assistant_generation_attempts ADD CONSTRAINT fk_assistant_generation_usage FOREIGN KEY(llm_usage_log_id) REFERENCES llm_usage_log(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
