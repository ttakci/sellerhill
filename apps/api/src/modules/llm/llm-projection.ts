import {
  computeMicroCost,
  type ProviderPricingRow,
  UsageCostKind,
  UsageEventSource,
  UsageMetric,
  type UsageEventParams,
} from '@repo/shared';

/**
 * Pure helper: build the `usage_events` projection rows for a single
 * `llm_usage_log` source row. Each token kind (prompt / completion / embedding)
 * becomes its own usage event, attributed to the user (or platform-level when
 * no user). Micro-USD cost is computed from the effective `llm_model_pricing`
 * row's per-million rate for each metric; when no pricing is configured, cost
 * is NULL (the plan: "fiyat yoksa maliyet NULL").
 *
 * `pricing` is a single resolved `ProviderPricingRow` (or null); the per-rate
 * is picked by metric (prompt=input, completion=output, embedding=embedding).
 */
export function buildLlmUsageEvents(args: {
  sourceLogId: string;
  provider: string;
  model: string;
  userId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  embeddingTokens?: number;
  pricing: ProviderPricingRow | null;
  occurredAt?: Date;
}): UsageEventParams[] {
  const {
    sourceLogId,
    provider,
    model,
    userId,
    promptTokens,
    completionTokens,
    embeddingTokens,
    pricing,
    occurredAt,
  } = args;

  const recordedAt = occurredAt ?? new Date();
  const metadata = { provider, model };
  const events: UsageEventParams[] = [];

  const addEvent = (
    metric: UsageMetric,
    tokens: number | undefined,
    perMillionMicros: number | null | undefined,
  ): void => {
    if (tokens === undefined || !Number.isFinite(tokens) || tokens <= 0) {
      return;
    }
    const cost = computeMicroCost(tokens, perMillionMicros);
    events.push({
      source: UsageEventSource.LLM,
      metric,
      providerRefId: sourceLogId,
      userId: userId ?? null,
      quantity: tokens,
      estimatedCostMicros: cost,
      currency: cost !== null ? (pricing?.currency ?? null) : null,
      costKind: cost !== null ? UsageCostKind.ESTIMATED : undefined,
      recordedAt,
      metadata,
    });
  };

  addEvent(UsageMetric.LLM_PROMPT_TOKENS, promptTokens, pricing?.inputCostPerMillionMicros);
  addEvent(UsageMetric.LLM_COMPLETION_TOKENS, completionTokens, pricing?.outputCostPerMillionMicros);
  addEvent(UsageMetric.LLM_EMBEDDING_TOKENS, embeddingTokens, pricing?.embeddingCostPerMillionMicros);

  return events;
}
