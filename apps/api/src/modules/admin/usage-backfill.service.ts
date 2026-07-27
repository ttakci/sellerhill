import { Injectable, Logger } from '@nestjs/common';
import {
  KeepaUsageSource,
  UsageEventSource,
  UsageMetric,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { buildKeepaUsageEvents } from '../listings/keepa-projection';
import { buildLlmUsageEvents } from '../llm/llm-projection';

import { ProviderPricingService } from './provider-pricing.service';
import { UsageEventsService } from './usage-events.service';

/**
 * Idempotent admin backfill: projects historical `keepa_usage_log` and
 * `llm_usage_log` rows into `usage_events`. Safe to run repeatedly — the partial
 * unique indexes (migration 050) make re-projection a no-op (idempotentSkip).
 *
 * Not wired to startup or any cron in this iteration (the plan: "ilk iterasyonda
 * otomatik startup backfill yok; kontrollü admin/CLI çağrısı sonraki operasyon
 * adımı olarak dokümante edilir"). An operator invokes `runBackfill()` via a
 * future admin endpoint / CLI. Processes in batches to bound memory; per-row
 * failures are isolated.
 */
@Injectable()
export class UsageBackfillService {
  private readonly logger = new Logger(UsageBackfillService.name);
  private static readonly BATCH_SIZE = 500;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usageEventsService: UsageEventsService,
    private readonly providerPricingService: ProviderPricingService,
  ) {}

  /** Backfill Keepa source rows missing a projection. Returns inserted count. */
  async backfillKeepa(): Promise<number> {
    let totalInserted = 0;
    let offset = 0;
    for (;;) {
      const rows = await this.databaseService.query<{
        id: string;
        asin: string;
        tokens: string;
        source: string;
        user_ids: string;
        requested_at: Date;
      }>(
        `SELECT k.id, k.asin, k.tokens::text AS tokens, k.source, k.user_ids::text AS user_ids, k.requested_at
         FROM keepa_usage_log k
         LEFT JOIN usage_events ue
           ON ue.source = $1 AND ue.metric = $2 AND ue.provider_ref_id = k.id::text
         WHERE ue.id IS NULL
         ORDER BY k.requested_at ASC
         LIMIT $3 OFFSET $4`,
        [UsageEventSource.KEEPA, UsageMetric.KEEPA_TOKENS, UsageBackfillService.BATCH_SIZE, offset],
      );
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const userIds = this.safeParseUserIds(row.user_ids);
        const tokens = Number(row.tokens);
        const keepaSource = this.asKeepaSource(row.source);
        const events = buildKeepaUsageEvents({
          sourceLogId: row.id,
          tokens,
          keepaSource,
          asin: row.asin,
          userIds,
          occurredAt: row.requested_at,
        });
        if (events.length === 0) {
          continue;
        }
        const results = await this.usageEventsService.appendBatch(events);
        totalInserted += results.filter((r) => r.inserted).length;
      }

      if (rows.length < UsageBackfillService.BATCH_SIZE) {
        break;
      }
      offset += UsageBackfillService.BATCH_SIZE;
    }
    this.logger.log(`Keepa backfill: ${totalInserted} new usage_events inserted.`);
    return totalInserted;
  }

  /** Backfill LLM source rows missing a projection. Returns inserted count. */
  async backfillLlm(): Promise<number> {
    let totalInserted = 0;
    let offset = 0;
    for (;;) {
      const rows = await this.databaseService.query<{
        id: string;
        user_id: string | null;
        model: string;
        prompt_tokens: number | null;
        completion_tokens: number | null;
        embedding_tokens: number | null;
        requested_at: Date;
      }>(
        `SELECT l.id, l.user_id, l.model, l.prompt_tokens, l.completion_tokens, l.embedding_tokens, l.requested_at
         FROM llm_usage_log l
         LEFT JOIN usage_events ue
           ON ue.source = $1 AND ue.metric = $2 AND ue.provider_ref_id = l.id::text
         WHERE ue.id IS NULL
         ORDER BY l.requested_at ASC
         LIMIT $3 OFFSET $4`,
        [UsageEventSource.LLM, UsageMetric.LLM_PROMPT_TOKENS, UsageBackfillService.BATCH_SIZE, offset],
      );
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const provider = 'llm';
        const occurredAt = row.requested_at;
        const pricing = await this.providerPricingService.getEffectivePricing(provider, row.model, occurredAt);
        const events = buildLlmUsageEvents({
          sourceLogId: row.id,
          provider,
          model: row.model,
          userId: row.user_id,
          promptTokens: row.prompt_tokens ?? undefined,
          completionTokens: row.completion_tokens ?? undefined,
          embeddingTokens: row.embedding_tokens ?? undefined,
          pricing,
          occurredAt,
        });
        if (events.length === 0) {
          continue;
        }
        const results = await this.usageEventsService.appendBatch(events);
        totalInserted += results.filter((r) => r.inserted).length;
      }

      if (rows.length < UsageBackfillService.BATCH_SIZE) {
        break;
      }
      offset += UsageBackfillService.BATCH_SIZE;
    }
    this.logger.log(`LLM backfill: ${totalInserted} new usage_events inserted.`);
    return totalInserted;
  }

  /** Run both backfills. Returns the total inserted count per source. */
  async runBackfill(): Promise<{ keepa: number; llm: number }> {
    const keepa = await this.backfillKeepa();
    const llm = await this.backfillLlm();
    return { keepa, llm };
  }

  /** Parse the keepa_usage_log.user_ids JSONB text back into a string array. */
  private safeParseUserIds(raw: string): string[] {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((u): u is string => typeof u === 'string' && u.length > 0);
    } catch {
      return [];
    }
  }

  /** Coerce a raw source string into the KeepaUsageSource enum, defaulting to REFRESH. */
  private asKeepaSource(raw: string): KeepaUsageSource {
    if (raw === (KeepaUsageSource.CREATE as string)) {
      return KeepaUsageSource.CREATE;
    }
    return KeepaUsageSource.REFRESH;
  }
}
