-- Embedding tables for the Zon Assistant knowledge/RAG feature.
--
-- WHY THIS FILE IS GUARDED (2026-08-14)
-- -------------------------------------
-- That feature was REMOVED in 2026-08 and replaced by the tawk.to widget (see
-- CLAUDE.md "Customer support widget — tawk.to"). The tables below are dormant:
-- no source code reads them, and no later migration depends on them. They exist
-- only because an applied migration is never deleted.
--
-- pgvector ships in local dev's `pgvector/pgvector` image but NOT in a stock
-- Postgres — Coolify provisions `postgres:18-alpine`. On a fresh database this
-- file therefore aborted the entire boot-time migration run with
--     error: extension "vector" is not available
-- which crash-looped the API before it could ever listen, on every deploy.
--
-- Requiring a special Postgres build in every environment, forever, for tables
-- nothing queries is not a dependency worth carrying — so the vector-dependent
-- objects are skipped when pgvector is absent. Behaviour by database:
--   pgvector available (local dev)  → identical to before, everything created
--   pgvector absent (stock image)   → objects skipped, migration marked applied
--   already applied (existing DBs)  → never re-runs, completely untouched
--
-- Statements after the early RETURN are never SPI-prepared, so the `vector(768)`
-- type is never resolved on a database that lacks the extension.
--
-- If the assistant is ever revived, point the database at a pgvector-capable
-- image and ship the tables as a NEW migration — do not edit this one.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE NOTICE 'pgvector unavailable - skipping dormant knowledge embedding objects (046)';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS vector;

  BEGIN
    CREATE TYPE knowledge_distance_metric AS ENUM ('cosine','l2','inner_product');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  CREATE TABLE IF NOT EXISTS knowledge_embedding_spaces (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), provider VARCHAR(100) NOT NULL, model VARCHAR(200) NOT NULL, dimensions INTEGER NOT NULL CHECK(dimensions IN (768,1536)),
   distance_metric knowledge_distance_metric NOT NULL, physical_table VARCHAR(63) NOT NULL CHECK(physical_table IN ('knowledge_embeddings_768','knowledge_embeddings_1536')),
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(provider,model,dimensions,distance_metric),
   CHECK((dimensions=768 AND physical_table='knowledge_embeddings_768') OR (dimensions=1536 AND physical_table='knowledge_embeddings_1536'))
  );

  ALTER TABLE knowledge_corpus_releases ADD CONSTRAINT fk_knowledge_release_embedding_space FOREIGN KEY(embedding_space_id) REFERENCES knowledge_embedding_spaces(id) ON DELETE RESTRICT;

  CREATE TABLE IF NOT EXISTS knowledge_embeddings_768 (
   chunk_id UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE, release_id UUID NOT NULL REFERENCES knowledge_corpus_releases(id) ON DELETE CASCADE,
   space_id UUID NOT NULL REFERENCES knowledge_embedding_spaces(id) ON DELETE RESTRICT, embedding vector(768) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(release_id,chunk_id)
  );
  CREATE TABLE IF NOT EXISTS knowledge_embeddings_1536 (
   chunk_id UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE, release_id UUID NOT NULL REFERENCES knowledge_corpus_releases(id) ON DELETE CASCADE,
   space_id UUID NOT NULL REFERENCES knowledge_embedding_spaces(id) ON DELETE RESTRICT, embedding vector(1536) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(release_id,chunk_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ke768_cosine ON knowledge_embeddings_768 USING hnsw(embedding vector_cosine_ops);
  CREATE INDEX IF NOT EXISTS idx_ke768_l2 ON knowledge_embeddings_768 USING hnsw(embedding vector_l2_ops);
  CREATE INDEX IF NOT EXISTS idx_ke768_ip ON knowledge_embeddings_768 USING hnsw(embedding vector_ip_ops);
  CREATE INDEX IF NOT EXISTS idx_ke1536_cosine ON knowledge_embeddings_1536 USING hnsw(embedding vector_cosine_ops);
  CREATE INDEX IF NOT EXISTS idx_ke1536_l2 ON knowledge_embeddings_1536 USING hnsw(embedding vector_l2_ops);
  CREATE INDEX IF NOT EXISTS idx_ke1536_ip ON knowledge_embeddings_1536 USING hnsw(embedding vector_ip_ops);
  CREATE INDEX IF NOT EXISTS idx_ke768_space_release ON knowledge_embeddings_768(space_id,release_id);
  CREATE INDEX IF NOT EXISTS idx_ke1536_space_release ON knowledge_embeddings_1536(space_id,release_id);

  CREATE OR REPLACE FUNCTION validate_knowledge_embedding_binding() RETURNS TRIGGER AS $fn$ DECLARE d INTEGER; t VARCHAR(63); rs UUID; BEGIN SELECT dimensions,physical_table INTO d,t FROM knowledge_embedding_spaces WHERE id=NEW.space_id; SELECT embedding_space_id INTO rs FROM knowledge_corpus_releases WHERE id=NEW.release_id; IF rs IS DISTINCT FROM NEW.space_id OR t<>TG_TABLE_NAME OR vector_dims(NEW.embedding)<>d THEN RAISE EXCEPTION 'embedding release/space/dimension mismatch'; END IF; RETURN NEW; END $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS ke768_binding ON knowledge_embeddings_768;
  CREATE TRIGGER ke768_binding BEFORE INSERT OR UPDATE ON knowledge_embeddings_768 FOR EACH ROW EXECUTE FUNCTION validate_knowledge_embedding_binding();
  DROP TRIGGER IF EXISTS ke1536_binding ON knowledge_embeddings_1536;
  CREATE TRIGGER ke1536_binding BEFORE INSERT OR UPDATE ON knowledge_embeddings_1536 FOR EACH ROW EXECUTE FUNCTION validate_knowledge_embedding_binding();

  CREATE OR REPLACE VIEW knowledge_embedding_space_health AS SELECT s.id,s.provider,s.model,s.dimensions,s.distance_metric,s.physical_table, to_regclass(s.physical_table) IS NOT NULL AS physical_table_exists FROM knowledge_embedding_spaces s;
END
$migration$;
