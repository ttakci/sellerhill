import { Injectable, Logger } from '@nestjs/common';
import { type ProviderPricingRow, UsageMetric } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/**
 * Reads effective-date provider pricing rows from `llm_model_pricing`
 * (migration 048). Used by the LLM projection to compute `estimatedCostMicros`
 * from token counts. Fail-soft: any error returns null (cost stays NULL).
 *
 * The pricing table stores per-million costs (input/output/embedding) in
 * micro-USD. The LLM projection picks the per-million rate matching the token
 * kind (prompt=input, completion=output, embedding=embedding) and uses
 * `computeMicroCost` to compute the event cost.
 *
 * Effective-date selection: fetches all rows for (provider, model) covering the
 * instant, then `resolveEffectivePricing` (finops-helpers) picks the latest
 * `effective_from`. No explicit effective_to column logic here — the helper
 * handles the window.
 */
@Injectable()
export class ProviderPricingService {
  private readonly logger = new Logger(ProviderPricingService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Resolve the effective pricing row for a (provider, model) at a point in
   * time. Returns null when no row matches (the plan: "fiyat yoksa maliyet
   * NULL"). Fail-soft: never throws.
   */
  async getEffectivePricing(
    provider: string,
    model: string,
    occurredAt: Date = new Date(),
  ): Promise<ProviderPricingRow | null> {
    try {
      const rows = await this.databaseService.query<ProviderPricingRow>(
        `SELECT provider, model,
                input_cost_per_million_micros::text AS "inputCostPerMillionMicros",
                output_cost_per_million_micros::text AS "outputCostPerMillionMicros",
                embedding_cost_per_million_micros::text AS "embeddingCostPerMillionMicros",
                currency,
                effective_from AS "effectiveFrom",
                effective_to AS "effectiveTo"
         FROM llm_model_pricing
         WHERE provider = $1 AND model = $2
         ORDER BY effective_from DESC`,
        [provider, model],
      );
      if (rows.length === 0) {
        return null;
      }
      // pg returns BIGINT as string to avoid precision loss; parse to number.
      const parsed = rows.map((r) => ({
        ...r,
        inputCostPerMillionMicros: Number(r.inputCostPerMillionMicros),
        outputCostPerMillionMicros: Number(r.outputCostPerMillionMicros),
        embeddingCostPerMillionMicros: Number(r.embeddingCostPerMillionMicros),
      }));
      // Pick the row covering the instant (latest effective_from <= occurredAt,
      // and effective_to is null or > occurredAt). Simple in JS to avoid SQL
      // window complexity.
      const atMs = occurredAt.getTime();
      const covering = parsed
        .filter((r) => {
          const fromMs = Date.parse(r.effectiveFrom);
          if (Number.isNaN(fromMs) || fromMs > atMs) {
            return false;
          }
          if (r.effectiveTo === null) {
            return true;
          }
          const toMs = Date.parse(r.effectiveTo);
          return !Number.isNaN(toMs) && toMs > atMs;
        })
        .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
      return covering[0] ?? null;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to resolve pricing for ${provider}/${model}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Convenience: resolve the per-million micro-USD rate for a specific token
   * metric from the effective pricing row. Returns null when no pricing or the
   * metric is not applicable.
   */
  getRateForMetric(
    pricing: ProviderPricingRow | null,
    metric: UsageMetric,
  ): number | null {
    if (!pricing) {
      return null;
    }
    switch (metric) {
      case UsageMetric.LLM_PROMPT_TOKENS:
        return pricing.inputCostPerMillionMicros;
      case UsageMetric.LLM_COMPLETION_TOKENS:
        return pricing.outputCostPerMillionMicros;
      case UsageMetric.LLM_EMBEDDING_TOKENS:
        return pricing.embeddingCostPerMillionMicros;
      default:
        return null;
    }
  }
}
