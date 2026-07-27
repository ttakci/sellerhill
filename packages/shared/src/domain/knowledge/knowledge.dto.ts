import type { SupportedLocale } from '../common/common.constants';

import type { KnowledgeDocumentCategory, KnowledgeDocumentVersionStatus, KnowledgeEmbeddingMetric, KnowledgeEmbeddingSpaceStatus, KnowledgeFrontmatterStatus, KnowledgeIngestionSource, KnowledgeIngestionStatus, KnowledgeReleaseStatus, KnowledgeVisibility } from './knowledge.enums';
export interface KnowledgeFrontmatterDto { slug: string; locale: SupportedLocale; title: string; summary: string; category: KnowledgeDocumentCategory; visibility: KnowledgeVisibility; version: number; status: KnowledgeFrontmatterStatus }
export interface StartKnowledgeIngestionRequest { source: KnowledgeIngestionSource; dryRun: boolean }
export interface KnowledgeIngestionDto { id: string; source: KnowledgeIngestionSource; status: KnowledgeIngestionStatus; dryRun: boolean; manifestChecksum: string; documentsTotal: number; documentsProcessed: number; chunksTotal: number; errorCode: string | null; createdAt: string; completedAt: string | null }
export interface KnowledgeDocumentDto { id: string; slug: string; category: KnowledgeDocumentCategory; visibility: KnowledgeVisibility; locales: SupportedLocale[]; activeVersionIds: string[]; createdAt: string; updatedAt: string }
export interface KnowledgeDocumentVersionDto { id: string; documentId: string; locale: SupportedLocale; version: number; checksum: string; title: string; summary: string; status: KnowledgeDocumentVersionStatus; chunkCount: number; createdAt: string }
export interface KnowledgeEmbeddingSpaceDto { id: string; provider: string; model: string; dimensions: number; distanceMetric: KnowledgeEmbeddingMetric; status: KnowledgeEmbeddingSpaceStatus; createdAt: string }
export interface KnowledgeReleaseDto { id: string; status: KnowledgeReleaseStatus; embeddingSpaceId: string; manifestChecksum: string; documentCount: number; localeCount: number; createdAt: string; publishedAt: string | null }
export interface KnowledgeReleaseListDto { items: KnowledgeReleaseDto[]; activeReleaseId: string | null }
export interface PublishKnowledgeReleaseRequest { releaseId: string }
export interface RollbackKnowledgeReleaseRequest { releaseId: string }
