import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../../common/database/database.service';

enum PersistedKnowledgeReleaseStatus {
  BUILDING = 'building',
  PUBLISHED = 'published',
}

export interface KnowledgeReleaseRow {
  id: string;
  releaseKey: string;
  status: PersistedKnowledgeReleaseStatus;
  manifestChecksum: string;
  embeddingSpaceId: string | null;
  itemCount: number;
  publishedAt: Date | null;
  createdAt: Date;
}
type DbRow = {
  id: string; release_key: string; status: PersistedKnowledgeReleaseStatus; manifest_checksum: string;
  embedding_space_id: string | null; item_count: number; published_at: Date | null; created_at: Date;
};
const COLUMNS = `id,release_key,status,manifest_checksum,embedding_space_id,item_count,published_at,created_at`;
const RELEASE_COLUMNS = `r.id,r.release_key,r.status,r.manifest_checksum,r.embedding_space_id,r.item_count,r.published_at,r.created_at`;
function mapRow(row: DbRow): KnowledgeReleaseRow {
  return { id: row.id, releaseKey: row.release_key, status: row.status,
    manifestChecksum: row.manifest_checksum, embeddingSpaceId: row.embedding_space_id,
    itemCount: row.item_count, publishedAt: row.published_at, createdAt: row.created_at };
}

@Injectable()
export class KnowledgeReleaseRepository {
  constructor(private readonly database: DatabaseService) {}

  async getActive(): Promise<KnowledgeReleaseRow | null> {
    const rows = await this.database.query<DbRow>(
      `SELECT ${RELEASE_COLUMNS}
       FROM knowledge_active_release a JOIN knowledge_corpus_releases r ON r.id=a.release_id
       WHERE a.singleton=TRUE AND r.status=$1`, [PersistedKnowledgeReleaseStatus.PUBLISHED],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async publishAtomic(client: PoolClient, releaseId: string): Promise<KnowledgeReleaseRow | null> {
    const locked = await client.query<DbRow>(
      `SELECT ${COLUMNS} FROM knowledge_corpus_releases WHERE id=$1 AND status=$2 FOR UPDATE`,
      [releaseId, PersistedKnowledgeReleaseStatus.BUILDING],
    );
    if (!locked.rows[0]) {
      return null;
    }
    const counts = await client.query<{ actual: number; expected: number }>(
      `SELECT COUNT(*)::int AS actual,r.item_count::int AS expected FROM knowledge_corpus_release_items i
       JOIN knowledge_corpus_releases r ON r.id=i.release_id WHERE r.id=$1 GROUP BY r.item_count`, [releaseId],
    );
    if (!counts.rows[0] || counts.rows[0].actual !== counts.rows[0].expected) {
      return null;
    }
    const result = await client.query<DbRow>(
      `UPDATE knowledge_corpus_releases SET status=$2,published_at=NOW() WHERE id=$1 RETURNING ${COLUMNS}`,
      [releaseId, PersistedKnowledgeReleaseStatus.PUBLISHED],
    );
    await client.query(
      `INSERT INTO knowledge_active_release(singleton,release_id,activated_at) VALUES(TRUE,$1,NOW())
       ON CONFLICT(singleton) DO UPDATE SET release_id=EXCLUDED.release_id,activated_at=EXCLUDED.activated_at`,
      [releaseId],
    );
    return mapRow(result.rows[0]);
  }
}
