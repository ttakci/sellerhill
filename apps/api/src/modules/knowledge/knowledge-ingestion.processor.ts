import { Processor, WorkerHost } from '@nestjs/bullmq';
import { extractCorrelationId, generateCorrelationId } from '@repo/shared';
import type { Job } from 'bullmq';

import { withCorrelation } from '../../common/observability/correlation.context';

import { KNOWLEDGE_INGESTION_JOB, KNOWLEDGE_INGESTION_QUEUE } from './knowledge-ingestion.constants';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';

export interface KnowledgeIngestionJobData { root: string }

@Processor(KNOWLEDGE_INGESTION_QUEUE, { concurrency: 1 })
export class KnowledgeIngestionProcessor extends WorkerHost {
  constructor(private readonly ingestion: KnowledgeIngestionService) { super(); }
  async process(job: Job<KnowledgeIngestionJobData>): Promise<unknown> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: KNOWLEDGE_INGESTION_QUEUE,
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        if (job.name !== KNOWLEDGE_INGESTION_JOB) {throw new Error('ingestion_failed');}
        return this.ingestion.ingest(job.data.root);
      }
    );
  }
}
