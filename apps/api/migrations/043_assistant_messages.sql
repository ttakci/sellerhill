DO $$ BEGIN CREATE TYPE assistant_message_author_type AS ENUM ('customer','assistant','support_agent','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_message_type AS ENUM ('text','handoff_request','handoff_accepted','handoff_resolved','returned_to_ai','system_notice'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_message_status AS ENUM ('pending','streaming','completed','incomplete','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_generation_status AS ENUM ('reserved','running','completed','incomplete','failed','rate_limited','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assistant_messages (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
 sequence BIGINT NOT NULL CHECK(sequence>0), client_message_id UUID, author_type assistant_message_author_type NOT NULL, author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 message_type assistant_message_type NOT NULL DEFAULT 'text', status assistant_message_status NOT NULL, content TEXT NOT NULL DEFAULT '',
 detected_locale VARCHAR(5) CHECK(detected_locale IS NULL OR detected_locale IN ('en','tr')), reply_to_message_id UUID REFERENCES assistant_messages(id) ON DELETE SET NULL,
 generation_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ, edited_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
 CONSTRAINT assistant_message_author CHECK ((author_type IN ('customer','support_agent') AND author_user_id IS NOT NULL) OR (author_type IN ('assistant','system') AND author_user_id IS NULL)),
 CONSTRAINT assistant_message_client_id CHECK ((author_type IN ('customer','support_agent')) = (client_message_id IS NOT NULL)),
 CONSTRAINT assistant_message_completion CHECK ((status='completed' AND completed_at IS NOT NULL) OR status<>'completed'),
 UNIQUE(conversation_id,sequence)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_messages_client ON assistant_messages(conversation_id,client_message_id) WHERE client_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_messages_generation ON assistant_messages(generation_id) WHERE generation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_messages_history ON assistant_messages(conversation_id,sequence DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_retention ON assistant_messages(created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS assistant_generation_attempts (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
 user_message_id UUID NOT NULL REFERENCES assistant_messages(id) ON DELETE CASCADE, assistant_message_id UUID NOT NULL REFERENCES assistant_messages(id) ON DELETE CASCADE,
 attempt_number INTEGER NOT NULL CHECK(attempt_number>0), status assistant_generation_status NOT NULL DEFAULT 'reserved', provider VARCHAR(100) NOT NULL, model VARCHAR(200) NOT NULL,
 retrieval_query TEXT, context_token_estimate INTEGER CHECK(context_token_estimate IS NULL OR context_token_estimate>=0), reserved_tokens INTEGER CHECK(reserved_tokens IS NULL OR reserved_tokens>=0),
 prompt_tokens INTEGER CHECK(prompt_tokens IS NULL OR prompt_tokens>=0), completion_tokens INTEGER CHECK(completion_tokens IS NULL OR completion_tokens>=0), total_tokens INTEGER CHECK(total_tokens IS NULL OR total_tokens>=0),
 llm_usage_log_id UUID, started_at TIMESTAMPTZ, first_token_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, error_code VARCHAR(100), error_detail_redacted VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_message_id,attempt_number), UNIQUE(assistant_message_id), CHECK(total_tokens IS NULL OR prompt_tokens IS NULL OR completion_tokens IS NULL OR total_tokens=prompt_tokens+completion_tokens)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_generation_active ON assistant_generation_attempts(user_message_id) WHERE status IN ('reserved','running');
CREATE INDEX IF NOT EXISTS idx_assistant_generation_conversation ON assistant_generation_attempts(conversation_id,created_at DESC);

ALTER TABLE assistant_messages ADD CONSTRAINT fk_assistant_messages_generation FOREIGN KEY(generation_id) REFERENCES assistant_generation_attempts(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS assistant_summary_revisions (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), summary_id UUID NOT NULL REFERENCES assistant_conversation_summaries(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0), through_sequence BIGINT NOT NULL CHECK(through_sequence>=0), content TEXT NOT NULL CHECK(length(content)>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(summary_id,revision)
);

CREATE TABLE IF NOT EXISTS assistant_message_citations (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), message_id UUID NOT NULL REFERENCES assistant_messages(id) ON DELETE CASCADE,
 knowledge_document_id UUID NOT NULL, knowledge_version_id UUID NOT NULL, knowledge_chunk_id UUID NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal>0),
 quoted_text TEXT NOT NULL, source_title VARCHAR(300) NOT NULL, source_locale VARCHAR(5) NOT NULL CHECK(source_locale IN ('en','tr')), source_path TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(message_id,ordinal), UNIQUE(message_id,knowledge_chunk_id)
);
