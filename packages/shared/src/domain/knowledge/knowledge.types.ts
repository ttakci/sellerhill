import type { KnowledgeEmbeddingMetric } from './knowledge.enums';
export interface EmbeddingModelInfo { provider: string; model: string; dimensions: number; maxBatchSize: number; distanceMetric: KnowledgeEmbeddingMetric }
export interface KnowledgeManifestItem { slug: string; locale: import('../common/common.constants').SupportedLocale; version: number; checksum: string; sourcePath: string }
export interface KnowledgeManifest { version: number; embeddingSpaceId: string; items: KnowledgeManifestItem[] }
