CREATE OR REPLACE FUNCTION prevent_published_knowledge_release_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('published','retired') THEN
    RAISE EXCEPTION 'published knowledge releases are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('published','retired') THEN
    IF NEW.id <> OLD.id OR NEW.release_key <> OLD.release_key OR NEW.manifest_checksum <> OLD.manifest_checksum
       OR NEW.embedding_space_id IS DISTINCT FROM OLD.embedding_space_id OR NEW.item_count <> OLD.item_count
       OR NEW.created_at <> OLD.created_at OR NEW.status NOT IN ('published','retired') THEN
      RAISE EXCEPTION 'published knowledge release content is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
