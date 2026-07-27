import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmUsagePurpose } from '@repo/shared';

import { LlmUsageService } from '../llm/llm-usage.service';
import { ProviderLimiterService } from '../llm/provider-limiter.service';

export interface EmbeddingSpace { provider: string; model: string; dimensions: number; distanceMetric: 'cosine' | 'l2' | 'inner_product'; }

@Injectable()
export class EmbeddingService {
  constructor(private readonly config: ConfigService, private readonly usage: LlmUsageService, private readonly limiter: ProviderLimiterService) {}
  space(): EmbeddingSpace {
    const dimensions = Number(this.config.get<string>('EMBEDDING_DIMENSIONS', '1536'));
    const metric = this.config.get<string>('EMBEDDING_DISTANCE_METRIC', 'cosine');
    if (![768, 1536].includes(dimensions) || !['cosine','l2','inner_product'].includes(metric)) {throw new Error('Invalid embedding model space');}
    return { provider: this.config.get<string>('LLM_PROVIDER', 'openai'), model: this.config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'), dimensions, distanceMetric: metric as EmbeddingSpace['distanceMetric'] };
  }
  async embed(input: string[], userId?: string): Promise<number[][]> {
    if (!input.length) {return [];}
    const space = this.space();
    const permit = await this.limiter.acquire({ userId, purpose: LlmUsagePurpose.ASSISTANT_EMBEDDING, estimatedEmbeddingTokens: input.reduce((n, x) => n + Math.ceil(x.length / 4), 0) });
    const started = Date.now();
    try {
      const base = (this.config.get<string>('LLM_BASE_URL') ?? '').replace(/\/$/, '');
      const key = this.config.get<string>('LLM_API_KEY');
      const response = await fetch(`${base}/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ model: space.model, input }) });
      if (!response.ok) {throw new Error(`Embedding provider HTTP ${response.status}`);}
      const json = await response.json() as { data?: Array<{ embedding?: unknown }>; usage?: { prompt_tokens?: number; total_tokens?: number } };
      const vectors = (json.data ?? []).map(x => x.embedding);
      if (vectors.length !== input.length || vectors.some(v => !Array.isArray(v) || v.length !== space.dimensions || v.some(n => typeof n !== 'number' || !Number.isFinite(n)))) {throw new Error('Embedding dimension mismatch');}
      await this.usage.log({ purpose: LlmUsagePurpose.ASSISTANT_EMBEDDING, model: space.model, provider: space.provider, userId, embeddingTokens: json.usage?.total_tokens, reservationTokens: permit.reservedTokens, latencyMs: Date.now() - started, success: true });
      return vectors as number[][];
    } catch (error) { await this.usage.log({ purpose: LlmUsagePurpose.ASSISTANT_EMBEDDING, model: space.model, provider: space.provider, userId, reservationTokens: permit.reservedTokens, latencyMs: Date.now() - started, success: false, error: error instanceof Error ? error.message : String(error) }); throw error; }
    finally { await permit.release(); }
  }
}
