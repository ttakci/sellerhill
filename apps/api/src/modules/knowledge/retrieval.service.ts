import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../common/database/database.service';

import { EmbeddingService } from './embedding.service';

export interface RetrievalCandidate { chunkId: string; documentId: string; locale: string; content: string; rank: number; score: number; confidence: number; }

@Injectable()
export class HybridRetrievalService {
  constructor(private readonly db: DatabaseService, private readonly embeddings: EmbeddingService) {}
  async search(query: string, locale: 'en' | 'tr', limit = 8): Promise<RetrievalCandidate[]> {
    const vector = (await this.embeddings.embed([query]))[0]; const space = this.embeddings.space();
    const table = space.dimensions === 768 ? 'knowledge_embeddings_768' : 'knowledge_embeddings_1536';
    const op = space.distanceMetric === 'cosine' ? '<=>' : space.distanceMetric === 'l2' ? '<->' : '<#>';
    const rows = await this.db.query<{ chunk_id: string; document_id: string; locale: string; content: string; score: number; rank: number }>(`WITH active AS (SELECT release_id FROM knowledge_active_release WHERE singleton=TRUE), f AS (SELECT c.id chunk_id,v.document_id,v.locale,c.content,ROW_NUMBER() OVER (ORDER BY ts_rank(c.search_vector,websearch_to_tsquery('simple',$1)) DESC) rank FROM knowledge_chunks c JOIN knowledge_document_versions v ON v.id=c.document_version_id JOIN knowledge_corpus_release_items i ON i.en_version_id=v.id OR i.tr_version_id=v.id JOIN active a ON a.release_id=i.release_id WHERE v.locale=$2 AND v.status='published' AND c.search_vector @@ websearch_to_tsquery('simple',$1) LIMIT $3), v AS (SELECT c.id chunk_id,v.document_id,v.locale,c.content,ROW_NUMBER() OVER (ORDER BY e.embedding ${op} $4::vector) rank, (1 - (e.embedding ${op} $4::vector)) score FROM ${table} e JOIN knowledge_chunks c ON c.id=e.chunk_id JOIN knowledge_document_versions v ON v.id=c.document_version_id JOIN active a ON a.release_id=e.release_id WHERE v.locale=$2 LIMIT $3) SELECT chunk_id,document_id,locale,content,MAX(score)::float score,MIN(rank)::int rank FROM (SELECT f.chunk_id,f.document_id,f.locale,f.content,1.0/(60+f.rank) score,f.rank FROM f UNION ALL SELECT v.chunk_id,v.document_id,v.locale,v.content,v.score,v.rank FROM v) x GROUP BY chunk_id,document_id,locale,content ORDER BY SUM(score) DESC LIMIT $3`, [query, locale, limit, `[${vector.join(',')}]`]);
    return rows.map((row, i) => ({ chunkId: row.chunk_id, documentId: row.document_id, locale: row.locale, content: row.content, rank: Number(row.rank), score: Number(row.score), confidence: Math.min(1, Number(row.score) * 2 / (i + 1)) }));
  }
}
