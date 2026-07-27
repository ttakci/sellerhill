import {
  computeMicroCost,
  type ProviderPricingRow,
  UsageCostKind,
  UsageEventSource,
  UsageMetric,
} from '@repo/shared';

import { buildLlmUsageEvents } from './llm-projection';

describe('computeMicroCost', () => {
  it('returns null when perMillionMicros is null', () => {
    expect(computeMicroCost(100, null)).toBeNull();
  });

  it('returns null for non-finite or negative quantity', () => {
    expect(computeMicroCost(Number.NaN, 100)).toBeNull();
    expect(computeMicroCost(-1, 100)).toBeNull();
  });

  it('returns null for negative rate', () => {
    expect(computeMicroCost(100, -1)).toBeNull();
  });

  it('computes quantity × perMillion / 1_000_000 rounded to nearest micro-USD', () => {
    // gpt-4o-mini prompt: $0.15 / 1M tokens = 150000 micro-USD per 1M
    // 1000 tokens × 150000 / 1_000_000 = 150 micro-USD
    expect(computeMicroCost(1000, 150000)).toBe(150);
  });

  it('rounds to nearest integer', () => {
    expect(computeMicroCost(1, 500)).toBe(0); // 0.0005 rounds to 0... actually 1*500/1e6 = 0.0005 → rounds to 1? No: 0.0005 < 0.5 → 0
    expect(computeMicroCost(2, 750000)).toBe(2); // 2*750000/1e6 = 1.5 → rounds to 2
  });
});

describe('buildLlmUsageEvents', () => {
  const baseArgs = {
    sourceLogId: 'llm-log-1',
    provider: 'openai',
    model: 'gpt-4o-mini',
  };

  const pricing: ProviderPricingRow = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillionMicros: 150000, // $0.15/1M
    outputCostPerMillionMicros: 600000, // $0.60/1M
    embeddingCostPerMillionMicros: 130000, // $0.13/1M
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    currency: 'USD',
  };

  it('emits separate prompt and completion events with computed micro-cost', () => {
    const events = buildLlmUsageEvents({
      ...baseArgs,
      promptTokens: 1000,
      completionTokens: 500,
      pricing,
    });
    expect(events).toHaveLength(2);
    const prompt = events.find((e) => e.metric === UsageMetric.LLM_PROMPT_TOKENS)!;
    const completion = events.find((e) => e.metric === UsageMetric.LLM_COMPLETION_TOKENS)!;
    expect(prompt.quantity).toBe(1000);
    expect(prompt.estimatedCostMicros).toBe(150); // 1000 × 150000 / 1e6
    expect(prompt.currency).toBe('USD');
    expect(prompt.costKind).toBe(UsageCostKind.ESTIMATED);
    expect(completion.quantity).toBe(500);
    expect(completion.estimatedCostMicros).toBe(300); // 500 × 600000 / 1e6
  });

  it('leaves cost NULL when pricing is null', () => {
    const events = buildLlmUsageEvents({
      ...baseArgs,
      promptTokens: 100,
      pricing: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0].estimatedCostMicros).toBeNull();
    expect(events[0].currency).toBeNull();
    expect(events[0].costKind).toBeUndefined();
  });

  it('skips token kinds that are undefined or <= 0', () => {
    const events = buildLlmUsageEvents({
      ...baseArgs,
      promptTokens: 0,
      completionTokens: undefined,
      embeddingTokens: -5,
      pricing,
    });
    expect(events).toEqual([]);
  });

  it('emits an embedding event when embedding tokens present', () => {
    const events = buildLlmUsageEvents({
      ...baseArgs,
      embeddingTokens: 200,
      pricing,
    });
    expect(events).toHaveLength(1);
    expect(events[0].metric).toBe(UsageMetric.LLM_EMBEDDING_TOKENS);
    expect(events[0].quantity).toBe(200);
    expect(events[0].estimatedCostMicros).toBe(26); // 200 × 130000 / 1e6 = 26
  });

  it('attributes to the user when userId provided, else platform-level', () => {
    const withUser = buildLlmUsageEvents({
      ...baseArgs,
      userId: 'user-1',
      promptTokens: 10,
      pricing: null,
    });
    expect(withUser[0].userId).toBe('user-1');

    const platform = buildLlmUsageEvents({
      ...baseArgs,
      promptTokens: 10,
      pricing: null,
    });
    expect(platform[0].userId).toBeNull();
  });

  it('uses the same providerRefId for all events (idempotency key)', () => {
    const events = buildLlmUsageEvents({
      ...baseArgs,
      promptTokens: 10,
      completionTokens: 20,
      embeddingTokens: 5,
      pricing: null,
    });
    expect(events.every((e) => e.providerRefId === 'llm-log-1')).toBe(true);
    expect(events.every((e) => e.source === UsageEventSource.LLM)).toBe(true);
  });
});
