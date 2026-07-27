import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeIngestionStatus } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class AssistantRetentionProcessor {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService) {}

  async process(): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query(`DELETE FROM assistant_event_outbox WHERE created_at < NOW()-($1::int*INTERVAL '1 day')`, [this.days('ASSISTANT_OUTBOX_RETENTION_DAYS', 7)]);
      await client.query(`DELETE FROM assistant_conversations WHERE delete_after IS NOT NULL AND delete_after<=NOW()`);
      await client.query(`DELETE FROM assistant_conversations WHERE updated_at < NOW()-($1::int*INTERVAL '1 day')`, [this.days('ASSISTANT_CONVERSATION_RETENTION_DAYS', 365)]);
      await client.query(`DELETE FROM assistant_ingestion_jobs WHERE status IN($2,$3) AND updated_at < NOW()-($1::int*INTERVAL '1 day')`, [this.days('ASSISTANT_FAILED_INGESTION_RETENTION_DAYS', 30), KnowledgeIngestionStatus.FAILED, KnowledgeIngestionStatus.CANCELLED]);
      await client.query(`DELETE FROM llm_usage_log WHERE requested_at < NOW()-($1::int*INTERVAL '1 day')`, [this.days('ASSISTANT_USAGE_RETENTION_DAYS', 730)]);
      await client.query(`DELETE FROM assistant_audit_log WHERE occurred_at < NOW()-($1::int*INTERVAL '1 day')`, [this.days('ASSISTANT_AUDIT_RETENTION_DAYS', 730)]);
    });
  }

  private days(key: string, fallback: number): number { const value = Number(this.config.get<string>(key, String(fallback))); return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback; }
}
