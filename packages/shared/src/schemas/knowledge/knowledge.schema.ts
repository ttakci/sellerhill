import { z } from 'zod';

import { SUPPORTED_LOCALES } from '../../domain/common/common.constants';
import { KnowledgeDocumentCategory, KnowledgeEmbeddingMetric, KnowledgeFrontmatterStatus, KnowledgeIngestionSource, KnowledgeVisibility } from '../../domain/knowledge/knowledge.enums';
const uuid = z.uuid();
export const knowledgeFrontmatterSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120), locale: z.enum(SUPPORTED_LOCALES), title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(500), category: z.enum(KnowledgeDocumentCategory), visibility: z.enum(KnowledgeVisibility), version: z.number().int().positive(), status: z.enum(KnowledgeFrontmatterStatus) }).strict();
export const startKnowledgeIngestionSchema = z.object({ source: z.enum(KnowledgeIngestionSource), dryRun: z.boolean() }).strict();
export const publishKnowledgeReleaseSchema = z.object({ releaseId: uuid }).strict();
export const rollbackKnowledgeReleaseSchema = publishKnowledgeReleaseSchema;
export const embeddingModelInfoSchema = z.object({ provider: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(200), dimensions: z.number().int().min(1).max(65535), maxBatchSize: z.number().int().min(1).max(2048), distanceMetric: z.enum(KnowledgeEmbeddingMetric) }).strict();
export const knowledgeListQuerySchema = z.object({ cursor: z.string().max(2048).optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
