-- Migration 093: drop the dormant Zon Assistant / knowledge-RAG / support schema.
--
-- WHY
-- ---
-- The custom LLM-backed customer-support assistant (Spec C) and its knowledge
-- ingestion / RAG pipeline were removed in 2026-08 when support moved to the
-- tawk.to widget (see CLAUDE.md "Customer support widget — tawk.to"). All of the
-- backend/frontend/shared code was deleted then, but migrations 041-047 + 049b
-- were left in place per the standing "an applied migration is never deleted"
-- practice, so ~26 tables, ~24 enum types, 4 trigger functions and 1 view have
-- been sitting orphaned since — nothing in apps/api, apps/web or packages/shared
-- reads or writes any of them (verified by grep before this migration).
--
-- This is the "future dedicated DROP TABLE migration" CLAUDE.md always said this
-- cleanup would need. It is deliberately a NEW file, not an edit of 041-047.
--
-- WHAT IS KEPT (these live in the same old migrations and are load-bearing):
--   * user_role enum, users.role / users.session_version, auth_refresh_sessions
--     + its trigger/function        — core auth/RBAC (migration 041)
--   * llm_model_pricing + the llm_usage_log columns provider / usage_source /
--     embedding_tokens / estimated_cost_micros / currency / pricing_id
--                                   — live FinOps projection (migration 048)
--   * usage_events, shared_cost_entries — admin Costs tab (migration 049a)
--
-- IF EXISTS / IF NOT EXISTS everywhere: migration 046 is skipped entirely on a
-- stock Postgres with no pgvector, so its objects may never have been created.

-- -----------------------------------------------------------------------------
-- 1. Detach the live llm_usage_log table from the dormant assistant tables.
--    These six columns (migration 048) are never written or read by any code
--    left in the tree. CASCADE clears the dependent CHECK constraint and the
--    three partial indexes (idx_llm_usage_generation / _conversation / _tenant_daily).
-- -----------------------------------------------------------------------------
ALTER TABLE llm_usage_log
  DROP COLUMN IF EXISTS conversation_id CASCADE,
  DROP COLUMN IF EXISTS message_id CASCADE,
  DROP COLUMN IF EXISTS generation_attempt_id CASCADE,
  DROP COLUMN IF EXISTS tenant_id CASCADE,
  DROP COLUMN IF EXISTS provider_request_id CASCADE,
  DROP COLUMN IF EXISTS reservation_tokens CASCADE;

-- -----------------------------------------------------------------------------
-- 2. Drop the dormant tables. CASCADE resolves inter-table FKs; the order is
--    still leaf-to-root so CASCADE has as little to do as possible.
-- -----------------------------------------------------------------------------

-- assistant messaging / conversations (migrations 042, 043)
DROP TABLE IF EXISTS assistant_message_citations CASCADE;
DROP TABLE IF EXISTS assistant_summary_revisions CASCADE;
DROP TABLE IF EXISTS assistant_conversation_summaries CASCADE;
DROP TABLE IF EXISTS assistant_generation_attempts CASCADE;
DROP TABLE IF EXISTS assistant_messages CASCADE;
DROP TABLE IF EXISTS assistant_conversation_participants CASCADE;

-- assistant quota / limiter (migration 047)
DROP TABLE IF EXISTS assistant_quota_reconciliations CASCADE;
DROP TABLE IF EXISTS assistant_quota_reservations CASCADE;
DROP TABLE IF EXISTS assistant_concurrency_leases CASCADE;
DROP TABLE IF EXISTS assistant_quota_ledger CASCADE;
DROP TABLE IF EXISTS assistant_limiter_state CASCADE;

-- assistant events / support ops (migrations 041, 042, 044)
DROP TABLE IF EXISTS assistant_event_outbox CASCADE;
DROP TABLE IF EXISTS support_audit_log CASCADE;
DROP TABLE IF EXISTS support_assignments CASCADE;
DROP TABLE IF EXISTS assistant_conversations CASCADE;
DROP TABLE IF EXISTS support_profiles CASCADE;

-- knowledge embeddings (migration 046 — pgvector-guarded, may not exist)
DROP TABLE IF EXISTS knowledge_embeddings_768 CASCADE;
DROP TABLE IF EXISTS knowledge_embeddings_1536 CASCADE;
DROP TABLE IF EXISTS knowledge_embedding_spaces CASCADE;

-- knowledge corpus / documents (migration 045)
DROP TABLE IF EXISTS knowledge_corpus_release_items CASCADE;
DROP TABLE IF EXISTS knowledge_active_release CASCADE;
DROP TABLE IF EXISTS knowledge_corpus_releases CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_document_versions CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;

-- -----------------------------------------------------------------------------
-- 3. Drop the dormant view + trigger functions (migrations 045, 046, 049b).
--    All are no-arg trigger functions; their triggers went with the tables above.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS knowledge_embedding_space_health;
DROP FUNCTION IF EXISTS validate_knowledge_embedding_binding();
DROP FUNCTION IF EXISTS validate_knowledge_release_item();
DROP FUNCTION IF EXISTS prevent_published_knowledge_release_mutation();
DROP FUNCTION IF EXISTS prevent_published_release_item_mutation();

-- -----------------------------------------------------------------------------
-- 4. Drop the dormant enum types. No CASCADE: every consuming table/column is
--    gone by now, so a plain DROP succeeds — and if some reference was missed
--    it errors loudly here instead of silently cascading.
--    NOT dropped: user_role (041), llm_usage_source (048), usage_event_source /
--    usage_metric / shared_cost_allocation_method (049a) — all still in use.
-- -----------------------------------------------------------------------------

-- migration 041
DROP TYPE IF EXISTS support_availability;

-- migration 042
DROP TYPE IF EXISTS assistant_conversation_mode;
DROP TYPE IF EXISTS assistant_conversation_status;
DROP TYPE IF EXISTS assistant_participant_role;
DROP TYPE IF EXISTS support_assignment_status;

-- migration 043
DROP TYPE IF EXISTS assistant_message_author_type;
DROP TYPE IF EXISTS assistant_message_type;
DROP TYPE IF EXISTS assistant_message_status;
DROP TYPE IF EXISTS assistant_generation_status;

-- migration 044
DROP TYPE IF EXISTS assistant_event_recipient_kind;
DROP TYPE IF EXISTS assistant_event_topic;
DROP TYPE IF EXISTS assistant_durable_event_type;
DROP TYPE IF EXISTS support_audit_action;

-- migration 045
DROP TYPE IF EXISTS knowledge_source_type;
DROP TYPE IF EXISTS knowledge_visibility;
DROP TYPE IF EXISTS knowledge_document_status;
DROP TYPE IF EXISTS knowledge_version_status;
DROP TYPE IF EXISTS knowledge_release_status;

-- migration 046 (pgvector-guarded)
DROP TYPE IF EXISTS knowledge_distance_metric;

-- migration 047
DROP TYPE IF EXISTS assistant_limiter_readiness;
DROP TYPE IF EXISTS assistant_reservation_status;
DROP TYPE IF EXISTS assistant_lease_status;
DROP TYPE IF EXISTS assistant_reconcile_status;
DROP TYPE IF EXISTS assistant_quota_scope;
