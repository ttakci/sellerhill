DO $$ BEGIN CREATE TYPE knowledge_source_type AS ENUM ('repository'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE knowledge_visibility AS ENUM ('customer','support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE knowledge_document_status AS ENUM ('active','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE knowledge_version_status AS ENUM ('draft','processing','published','failed','superseded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE knowledge_release_status AS ENUM ('building','published','failed','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS knowledge_documents (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), slug VARCHAR(200) NOT NULL UNIQUE, source_type knowledge_source_type NOT NULL DEFAULT 'repository', visibility knowledge_visibility NOT NULL,
 default_locale VARCHAR(5) NOT NULL DEFAULT 'en' CHECK(default_locale IN ('en','tr')), status knowledge_document_status NOT NULL DEFAULT 'active', created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS knowledge_document_versions (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, locale VARCHAR(5) NOT NULL CHECK(locale IN ('en','tr')),
 version INTEGER NOT NULL CHECK(version>0), title VARCHAR(300) NOT NULL, summary TEXT NOT NULL, source_path TEXT NOT NULL, source_checksum CHAR(64) NOT NULL, content_checksum CHAR(64) NOT NULL,
 status knowledge_version_status NOT NULL DEFAULT 'draft', published_at TIMESTAMPTZ, ingested_at TIMESTAMPTZ, ingestion_error_code VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(document_id,locale,version), UNIQUE(source_path,source_checksum), CHECK((status='published')=(published_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS knowledge_chunks (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), document_version_id UUID NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
 ordinal INTEGER NOT NULL CHECK(ordinal>=0), heading_path TEXT, content TEXT NOT NULL CHECK(length(content)>0), token_count INTEGER NOT NULL CHECK(token_count>0), content_hash CHAR(64) NOT NULL,
 search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple',coalesce(heading_path,'')||' '||content)) STORED, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(document_version_id,ordinal), UNIQUE(document_version_id,content_hash)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts ON knowledge_chunks USING GIN(search_vector);

CREATE TABLE IF NOT EXISTS knowledge_corpus_releases (
 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), release_key UUID NOT NULL UNIQUE, status knowledge_release_status NOT NULL DEFAULT 'building', manifest_checksum CHAR(64) NOT NULL UNIQUE,
 embedding_space_id UUID, item_count INTEGER NOT NULL CHECK(item_count>=0), published_at TIMESTAMPTZ, retired_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((status='published')=(published_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS knowledge_corpus_release_items (
 release_id UUID NOT NULL REFERENCES knowledge_corpus_releases(id) ON DELETE RESTRICT, document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE RESTRICT,
 en_version_id UUID NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE RESTRICT, tr_version_id UUID NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE RESTRICT,
 pair_checksum CHAR(64) NOT NULL, PRIMARY KEY(release_id,document_id), UNIQUE(release_id,en_version_id), UNIQUE(release_id,tr_version_id), CHECK(en_version_id<>tr_version_id)
);
CREATE TABLE IF NOT EXISTS knowledge_active_release (
 singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton), release_id UUID NOT NULL REFERENCES knowledge_corpus_releases(id) ON DELETE RESTRICT, activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION validate_knowledge_release_item() RETURNS TRIGGER AS $$
DECLARE en_doc UUID; en_locale VARCHAR(5); en_status knowledge_version_status; tr_doc UUID; tr_locale VARCHAR(5); tr_status knowledge_version_status;
BEGIN
 SELECT document_id,locale,status INTO en_doc,en_locale,en_status FROM knowledge_document_versions WHERE id=NEW.en_version_id;
 SELECT document_id,locale,status INTO tr_doc,tr_locale,tr_status FROM knowledge_document_versions WHERE id=NEW.tr_version_id;
 IF en_doc IS DISTINCT FROM NEW.document_id OR tr_doc IS DISTINCT FROM NEW.document_id OR en_locale<>'en' OR tr_locale<>'tr' OR en_status<>'published' OR tr_status<>'published' THEN RAISE EXCEPTION 'release item requires published EN/TR versions of the same document'; END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS knowledge_release_item_validate ON knowledge_corpus_release_items;
CREATE TRIGGER knowledge_release_item_validate BEFORE INSERT OR UPDATE ON knowledge_corpus_release_items FOR EACH ROW EXECUTE FUNCTION validate_knowledge_release_item();

CREATE OR REPLACE FUNCTION prevent_published_knowledge_release_mutation() RETURNS TRIGGER AS $$ BEGIN IF OLD.status IN ('published','retired') THEN RAISE EXCEPTION 'published knowledge releases are immutable'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS knowledge_release_immutable ON knowledge_corpus_releases;
CREATE TRIGGER knowledge_release_immutable BEFORE UPDATE OR DELETE ON knowledge_corpus_releases FOR EACH ROW EXECUTE FUNCTION prevent_published_knowledge_release_mutation();
CREATE OR REPLACE FUNCTION prevent_published_release_item_mutation() RETURNS TRIGGER AS $$ DECLARE rid UUID; BEGIN rid:=COALESCE(NEW.release_id,OLD.release_id); IF EXISTS(SELECT 1 FROM knowledge_corpus_releases WHERE id=rid AND status IN ('published','retired')) THEN RAISE EXCEPTION 'published release items are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS knowledge_release_items_immutable ON knowledge_corpus_release_items;
CREATE TRIGGER knowledge_release_items_immutable BEFORE INSERT OR UPDATE OR DELETE ON knowledge_corpus_release_items FOR EACH ROW EXECUTE FUNCTION prevent_published_release_item_mutation();
