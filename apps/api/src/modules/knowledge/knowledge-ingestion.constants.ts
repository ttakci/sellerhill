export const KNOWLEDGE_INGESTION_QUEUE = 'knowledge-ingestion';
export const KNOWLEDGE_INGESTION_JOB = 'ingest-candidate';
export const KNOWLEDGE_EXPECTED_PAIR_COUNT = 18;
export const KNOWLEDGE_EMBED_BATCH_SIZE = 32;
export const KNOWLEDGE_JOB_ATTEMPTS = 3;

export enum PersistedKnowledgeReleaseStatus {
  BUILDING = 'building',
  PUBLISHED = 'published',
  FAILED = 'failed',
  RETIRED = 'retired',
}

export enum PersistedKnowledgeVersionStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  SUPERSEDED = 'superseded',
}

export enum KnowledgeAdminOperation {
  VALIDATE = 'validate',
  DRY_RUN = 'dry-run',
  INGEST = 'ingest',
  PUBLISH = 'publish',
  STATUS = 'status',
  ROLLBACK = 'rollback',
}
