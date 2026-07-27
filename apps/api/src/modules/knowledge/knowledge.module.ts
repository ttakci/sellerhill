import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { LlmModule } from '../llm/llm.module';

import { EmbeddingService } from './embedding.service';
import { KnowledgeAdminController } from './knowledge-admin.controller';
import { KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion.constants';
import { KnowledgeIngestionProcessor } from './knowledge-ingestion.processor';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';
import { KnowledgeReleaseRepository } from './repositories/knowledge-release.repository';
import { HybridRetrievalService } from './retrieval.service';

@Module({
  imports: [DatabaseModule, LlmModule, BullModule.registerQueue({ name: KNOWLEDGE_INGESTION_QUEUE })],
  controllers: [KnowledgeAdminController],
  providers: [
    EmbeddingService,
    HybridRetrievalService,
    KnowledgeReleaseRepository,
    KnowledgeIngestionService,
    KnowledgeIngestionProcessor,
  ],
  exports: [EmbeddingService, HybridRetrievalService, KnowledgeReleaseRepository],
})
export class KnowledgeModule {}
