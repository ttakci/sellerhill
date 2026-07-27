DO $$ BEGIN CREATE TYPE assistant_event_recipient_kind AS ENUM ('user','topic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_event_topic AS ENUM ('support_queue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_durable_event_type AS ENUM ('conversation_created','conversation_updated','conversation_deleted','conversation_restored','message_created','message_completed','message_incomplete','assignment_updated','support_queue_updated','read_updated','availability_updated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE support_audit_action AS ENUM ('queue_viewed','conversation_opened','claimed','released','transferred','message_sent','resolved','reopened','returned_to_ai','admin_override_viewed','role_changed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assistant_event_outbox (
 id BIGSERIAL PRIMARY KEY, event_id UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE, event_type assistant_durable_event_type NOT NULL,
 recipient_kind assistant_event_recipient_kind NOT NULL, recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE, recipient_topic assistant_event_topic,
 conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE CASCADE, sequence BIGINT CHECK(sequence IS NULL OR sequence>0), aggregate_id UUID NOT NULL, aggregate_version BIGINT NOT NULL CHECK(aggregate_version>0),
 available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lease_owner UUID, leased_until TIMESTAMPTZ, attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 last_error_code VARCHAR(100), dispatched_at TIMESTAMPTZ, dead_lettered_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '7 days'), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((recipient_kind='user' AND recipient_user_id IS NOT NULL AND recipient_topic IS NULL) OR (recipient_kind='topic' AND recipient_topic IS NOT NULL AND recipient_user_id IS NULL)),
 CHECK((lease_owner IS NULL)=(leased_until IS NULL)), CHECK(expires_at>created_at), CHECK(dispatched_at IS NULL OR dead_lettered_at IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_user_replay ON assistant_event_outbox(recipient_user_id,id) WHERE recipient_kind='user' AND dead_lettered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_topic_replay ON assistant_event_outbox(recipient_topic,id) WHERE recipient_kind='topic' AND dead_lettered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_dispatch ON assistant_event_outbox(available_at,id) WHERE dispatched_at IS NULL AND dead_lettered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_lease_takeover ON assistant_event_outbox(leased_until,id) WHERE dispatched_at IS NULL AND dead_lettered_at IS NULL AND leased_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_cleanup ON assistant_event_outbox(expires_at);
CREATE INDEX IF NOT EXISTS idx_assistant_outbox_conversation ON assistant_event_outbox(conversation_id,id) WHERE conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_audit_log (
 id BIGSERIAL PRIMARY KEY, conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE SET NULL, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 action support_audit_action NOT NULL, previous_mode assistant_conversation_mode, previous_status assistant_conversation_status,
 next_mode assistant_conversation_mode, next_status assistant_conversation_status, assignment_id UUID REFERENCES support_assignments(id) ON DELETE SET NULL,
 target_user_id UUID REFERENCES users(id) ON DELETE SET NULL, reason_code VARCHAR(100), request_id UUID, ip_hash CHAR(64), user_agent_hash CHAR(64), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_audit_conversation ON support_audit_log(conversation_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_audit_actor ON support_audit_log(actor_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_audit_retention ON support_audit_log(created_at);
