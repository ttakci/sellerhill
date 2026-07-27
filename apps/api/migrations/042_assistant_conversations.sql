DO $$ BEGIN CREATE TYPE assistant_conversation_mode AS ENUM ('ai','waiting_for_support','human'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_conversation_status AS ENUM ('open','resolved','archived','deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assistant_participant_role AS ENUM ('customer','support_agent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE support_assignment_status AS ENUM ('active','released','resolved','transferred'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assistant_conversations (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_conversation_id UUID, title VARCHAR(160), mode assistant_conversation_mode NOT NULL DEFAULT 'ai', status assistant_conversation_status NOT NULL DEFAULT 'open',
 locale VARCHAR(5) NOT NULL CHECK (locale IN ('en','tr')), assigned_support_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 support_requested_at TIMESTAMPTZ, support_claimed_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, archived_at TIMESTAMPTZ,
 deleted_at TIMESTAMPTZ, delete_after TIMESTAMPTZ, restore_status assistant_conversation_status, last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0), version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT assistant_conversation_canonical_state CHECK (
  (status='open' AND mode='ai' AND assigned_support_user_id IS NULL) OR
  (status='open' AND mode='waiting_for_support' AND assigned_support_user_id IS NULL AND support_requested_at IS NOT NULL) OR
  (status='open' AND mode='human' AND assigned_support_user_id IS NOT NULL AND support_claimed_at IS NOT NULL) OR
  (status='resolved' AND mode='ai' AND assigned_support_user_id IS NULL AND resolved_at IS NOT NULL) OR
  (status='archived' AND mode='ai' AND assigned_support_user_id IS NULL AND archived_at IS NOT NULL) OR
  (status='deleted' AND mode='ai' AND assigned_support_user_id IS NULL AND deleted_at IS NOT NULL AND delete_after IS NOT NULL)),
 CONSTRAINT assistant_conversation_restore_snapshot CHECK (restore_status IS NULL OR (status='deleted' AND restore_status IN ('open','resolved','archived'))),
 CONSTRAINT assistant_conversation_delete_window CHECK (delete_after IS NULL OR (deleted_at IS NOT NULL AND delete_after > deleted_at))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_conversations_client ON assistant_conversations(user_id,client_conversation_id) WHERE client_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_tenant ON assistant_conversations(user_id,updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_queue ON assistant_conversations(support_requested_at,last_message_at,id) WHERE status='open' AND mode='waiting_for_support';
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_assignee ON assistant_conversations(assigned_support_user_id,updated_at DESC) WHERE status='open' AND mode='human';
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_history ON assistant_conversations(user_id,last_message_at DESC,id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_retention ON assistant_conversations(delete_after) WHERE delete_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS assistant_conversation_participants (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, participant_role assistant_participant_role NOT NULL,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), left_at TIMESTAMPTZ, last_read_sequence BIGINT NOT NULL DEFAULT 0 CHECK(last_read_sequence>=0),
 last_read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(left_at IS NULL OR left_at>=joined_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_participants_active ON assistant_conversation_participants(conversation_id,user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_participants_user_active ON assistant_conversation_participants(user_id,conversation_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS support_assignments (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
 support_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, status support_assignment_status NOT NULL DEFAULT 'active',
 claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), released_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, release_reason VARCHAR(100),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK ((status='active' AND released_at IS NULL AND resolved_at IS NULL) OR (status IN ('released','transferred') AND released_at IS NOT NULL AND resolved_at IS NULL) OR (status='resolved' AND resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_support_assignments_active ON support_assignments(conversation_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_support_assignments_agent_active ON support_assignments(support_user_id,claimed_at) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_support_assignments_history ON support_assignments(conversation_id,claimed_at DESC);

CREATE TABLE IF NOT EXISTS assistant_conversation_summaries (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0), through_sequence BIGINT NOT NULL CHECK(through_sequence>=0), summary TEXT NOT NULL CHECK(length(summary)>0),
 superseded_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(conversation_id,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_summary_current ON assistant_conversation_summaries(conversation_id) WHERE superseded_at IS NULL;
