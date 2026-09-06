import { Injectable, Logger } from '@nestjs/common';
import { LlmUsagePurpose, LlmUsageSource } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { ProviderPricingService } from '../admin/provider-pricing.service';
import { UsageEventsService } from '../admin/usage-events.service';

import { buildLlmUsageEvents } from './llm-projection';

export interface LlmUsageLogParams {
  userId?: string;
  purpose: LlmUsagePurpose;
  model: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  embeddingTokens?: number;
  latencyMs?: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly providerPricingService: ProviderPricingService,
    private readonly usageEventsService: UsageEventsService
  ) {}

  async log(params: LlmUsageLogParams): Promise<string | undefined> {
    try {
      const rows = await this.databaseService.query<{ id: string }>(
        `INSERT INTO llm_usage_log
         (user_id,purpose,model,provider,prompt_tokens,completion_tokens,embedding_tokens,usage_source,latency_ms,success,error)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [params.userId??null,params.purpose,params.model,params.provider??null,params.promptTokens??null,params.completionTokens??null,params.embeddingTokens??null,
          params.promptTokens===undefined&&params.completionTokens===undefined?LlmUsageSource.ESTIMATED:LlmUsageSource.PROVIDER,
          params.latencyMs??null,params.success,params.error?.slice(0,200)??null]
      );
      const sourceLogId = rows[0]?.id;
      if (!sourceLogId) {return undefined;}

      const occurredAt = new Date();
      const provider = params.provider ?? 'llm';
      const pricing = await this.providerPricingService.getEffectivePricing(provider, params.model, occurredAt);
      const events = buildLlmUsageEvents({
        sourceLogId,
        provider,
        model: params.model,
        userId: params.userId,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        embeddingTokens: params.embeddingTokens,
        pricing,
        occurredAt,
      });
      const results = await this.usageEventsService.appendBatch(events);
      const failed = results.filter((result) => result.failed).length;
      if (failed > 0) {
        this.logger.warn(`LLM usage projection failed for ${failed}/${results.length} events; source log retained`);
      }
      return sourceLogId;
    } catch (error: unknown) {
      this.logger.error(`Failed to log LLM usage: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}
