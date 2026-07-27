CREATE EXTENSION IF NOT EXISTS vector;
DO $$ BEGIN CREATE TYPE knowledge_distance_metric AS ENUM ('cosine','l2','inner_product'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
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
CREATE OR REPLACE FUNCTION validate_knowledge_embedding_binding() RETURNS TRIGGER AS $$ DECLARE d INTEGER; t VARCHAR(63); rs UUID; BEGIN SELECT dimensions,physical_table INTO d,t FROM knowledge_embedding_spaces WHERE id=NEW.space_id; SELECT embedding_space_id INTO rs FROM knowledge_corpus_releases WHERE id=NEW.release_id; IF rs IS DISTINCT FROM NEW.space_id OR t<>TG_TABLE_NAME OR vector_dims(NEW.embedding)<>d THEN RAISE EXCEPTION 'embedding release/space/dimension mismatch'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS ke768_binding ON knowledge_embeddings_768; CREATE TRIGGER ke768_binding BEFORE INSERT OR UPDATE ON knowledge_embeddings_768 FOR EACH ROW EXECUTE FUNCTION validate_knowledge_embedding_binding();
DROP TRIGGER IF EXISTS ke1536_binding ON knowledge_embeddings_1536; CREATE TRIGGER ke1536_binding BEFORE INSERT OR UPDATE ON knowledge_embeddings_1536 FOR EACH ROW EXECUTE FUNCTION validate_knowledge_embedding_binding();
CREATE OR REPLACE VIEW knowledge_embedding_space_health AS SELECT s.id,s.provider,s.model,s.dimensions,s.distance_metric,s.physical_table, to_regclass(s.physical_table) IS NOT NULL AS physical_table_exists FROM knowledge_embedding_spaces s;
