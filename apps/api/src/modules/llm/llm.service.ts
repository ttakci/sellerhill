// apps/api/src/modules/llm/llm.service.ts
import { ConfigService } from '@nestjs/config';
import {
  LlmUsagePurpose,
  type LlmChatChunk,
  type LlmChatOptions,
  type LlmChatResult,
  type LlmMessage,
} from '@repo/shared';

import { LlmUsageService } from './llm-usage.service';
import { LlmError, LlmRateLimitError, LlmResponseError, LlmTimeoutError, LlmUnavailableError } from './llm.errors';
import { parseSseChunk } from './sse-parser';

const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_AFTER_MS = 1000;

interface ResolvedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  model: string;
  timeoutMs: number;
}

/**
 * OpenAI-compatible Chat Completions client. Provider is env-only — there is
 * no provider registry and no swappable abstraction. Serves two callers:
 * content-gen (non-streaming `chat`) and the future assistant (streaming
 * `chatStream`).
 */
export class LlmService {
  constructor(
    private readonly config: ConfigService,
    private readonly usage: LlmUsageService
  ) {}

  // ---------- public API ----------

  /** Provider is reachable when base URL + at least one model are configured. */
  isAvailable(): boolean {
    const base = (this.config.get<string>('LLM_BASE_URL') ?? '').trim();
    const contentModel = (this.config.get<string>('LLM_CONTENT_MODEL') ?? '').trim();
    const assistantModel = (this.config.get<string>('LLM_ASSISTANT_MODEL') ?? '').trim();
    return base.length > 0 && (contentModel.length > 0 || assistantModel.length > 0);
  }

  /** Non-streaming Chat Completions call. */
  async chat(
    messages: LlmMessage[],
    opts: LlmChatOptions = {}
  ): Promise<LlmChatResult> {
    const model = this.resolveModel(opts);
    const started = Date.now();
    try {
      const res = await this.request(messages, opts, model, false);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const raw = json.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || raw.length === 0) {
        throw new LlmResponseError('LLM returned empty content', res.status);
      }

      const result: LlmChatResult = {
        text: raw,
        model: json.model ?? model,
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
      };

      this.safeLog(opts, model, result.promptTokens, result.completionTokens, started, true);
      return result;
    } catch (error) {
      this.safeLog(opts, model, undefined, undefined, started, false, error);
      throw error;
    }
  }

  /** Streaming Chat Completions call. Yields accumulated text + final done. */
  async *chatStream(
    messages: LlmMessage[],
    opts: LlmChatOptions = {}
  ): AsyncIterable<LlmChatChunk> {
    const model = this.resolveModel(opts);
    const started = Date.now();
    let accumulated = '';
    let success = false;
    try {
      const res = await this.request(messages, opts, model, true);
      if (res.body === null || res.body === undefined) {
        throw new LlmResponseError('LLM stream returned no body', res.status);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rest = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        rest += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(rest);
        rest = parsed.rest;
        for (const event of parsed.events) {
          if (event.data === '[DONE]') {
            yield { delta: accumulated, model, done: true };
            success = true;
            this.safeLog(opts, model, undefined, undefined, started, true);
            return;
          }
          let parsedEvent: { choices?: Array<{ delta?: { content?: string } }> };
          try {
            parsedEvent = JSON.parse(event.data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
          } catch {
            continue; // skip malformed event
          }
          const delta = parsedEvent.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            accumulated += delta;
            yield { delta: accumulated, model, done: false };
          }
        }
      }
      // Stream ended without [DONE] — emit terminal chunk anyway.
      yield { delta: accumulated, model, done: true };
      success = true;
      this.safeLog(opts, model, undefined, undefined, started, true);
    } catch (error) {
      this.safeLog(opts, model, undefined, undefined, started, success, error);
      throw error;
    }
  }

  // ---------- internals ----------

  private resolveModel(opts: LlmChatOptions): string {
    if (opts.model && opts.model.trim().length > 0) {
      return opts.model.trim();
    }
    if (opts.purpose === LlmUsagePurpose.ASSISTANT) {
      return (this.config.get<string>('LLM_ASSISTANT_MODEL') ?? '').trim();
    }
    return (this.config.get<string>('LLM_CONTENT_MODEL') ?? '').trim();
  }

  private buildRequest(
    messages: LlmMessage[],
    opts: LlmChatOptions,
    model: string,
    stream: boolean
  ): ResolvedRequest {
    const base = (this.config.get<string>('LLM_BASE_URL') ?? '').trim();
    const url = `${base.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = (this.config.get<string>('LLM_API_KEY') ?? '').trim();
    if (key.length > 0) {
      headers.Authorization = `Bearer ${key}`;
    }
    const body = JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream,
    });
    const timeoutMs = opts.timeoutMs ?? this.readTimeout();
    return { url, headers, body, model, timeoutMs };
  }

  private readTimeout(): number {
    const raw = this.config.get<string>('LLM_TIMEOUT_MS');
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Execute the HTTP request with a 3-attempt cap on HTTP 429. Honors an
   * overall timeoutMs budget: a 429 retry that would push past the budget
   * throws LlmRateLimitError instead of sleeping.
   */
  private async request(
    messages: LlmMessage[],
    opts: LlmChatOptions,
    model: string,
    stream: boolean
  ): Promise<Response> {
    const spec = this.buildRequest(messages, opts, model, stream);
    const deadline = Date.now() + spec.timeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
    if (opts.signal !== undefined) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        controller.abort();
      } else {
        opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    try {
      let last429RetryAfterMs: number | undefined;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        let res: Response;
        try {
          res = await fetch(spec.url, {
            method: 'POST',
            headers: spec.headers,
            body: spec.body,
            signal: controller.signal,
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new LlmTimeoutError();
          }
          throw error instanceof LlmError
            ? error
            : new LlmUnavailableError(error instanceof Error ? error.message : undefined);
        }

        if (res.status === 429) {
          last429RetryAfterMs = this.parseRetryAfterMs(res.headers.get('Retry-After'));
          if (attempt === MAX_ATTEMPTS) {
            throw new LlmRateLimitError('LLM rate limited', last429RetryAfterMs);
          }
          const remaining = deadline - Date.now();
          if (last429RetryAfterMs > remaining) {
            throw new LlmRateLimitError('LLM rate limited', last429RetryAfterMs);
          }
          await sleep(last429RetryAfterMs);
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new LlmResponseError(
            `LLM request failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
            res.status
          );
        }
        return res;
      }
      // Unreachable: loop either returns or throws.
      throw new LlmRateLimitError('LLM rate limited', last429RetryAfterMs);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseRetryAfterMs(header: string | null | undefined): number {
    if (header === null || header === undefined || header.length === 0) {
      return DEFAULT_RETRY_AFTER_MS;
    }
    const seconds = Number(header);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return DEFAULT_RETRY_AFTER_MS;
    }
    return Math.round(seconds * 1000);
  }

  /** Fire-and-forget usage logging — never throws to the caller. */
  private safeLog(
    opts: LlmChatOptions,
    model: string,
    promptTokens: number | undefined,
    completionTokens: number | undefined,
    startedAt: number,
    success: boolean,
    error?: unknown
  ): void {
    const purpose =
      opts.purpose === LlmUsagePurpose.ASSISTANT
        ? LlmUsagePurpose.ASSISTANT
        : LlmUsagePurpose.CONTENT;
    const params = {
      userId: opts.userId,
      purpose,
      model,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - startedAt,
      success,
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : error !== undefined
            ? String(error)
            : undefined,
    };
    void this.usage.log(params).catch(() => {
      // swallow — logging must never break the caller
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
