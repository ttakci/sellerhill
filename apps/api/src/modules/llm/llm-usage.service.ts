// apps/api/src/modules/llm/llm-usage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LlmUsagePurpose } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

export interface LlmUsageLogParams {
  userId?: string;
  purpose: LlmUsagePurpose;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class LlmUsageService {
  private readonly logger = new Logger(LlmUsageService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /** Insert one usage row. Failures never break the caller. */
  async log(params: LlmUsageLogParams): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO llm_usage_log
           (user_id, purpose, model, prompt_tokens, completion_tokens, latency_ms, success, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.userId ?? null,
          params.purpose,
          params.model,
          params.promptTokens ?? null,
          params.completionTokens ?? null,
          params.latencyMs ?? null,
          params.success,
          params.error ? params.error.slice(0, 200) : null,
        ]
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to log LLM usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
