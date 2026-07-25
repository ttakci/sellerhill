// packages/shared/src/domain/llm/llm.types.ts

/** OpenAI-compatible chat message. */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatOptions {
  /** Override the per-purpose model for this call. */
  model?: string;
  /** Selects the default model when `model` is omitted. */
  purpose?: 'content' | 'assistant';
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Caller-supplied abort signal (honored alongside internal timeout). */
  signal?: AbortSignal;
  /**
   * Optional attribution for llm_usage_log. Content-gen may omit (no user
   * context on the service today); assistant (C) should pass userId.
   */
  userId?: string;
}

/** Streaming chunk — `delta` is accumulated text so far (not raw incremental). */
export interface LlmChatChunk {
  delta: string;
  model: string;
  done: boolean;
}

export interface LlmChatResult {
  text: string;
  model: string;
  /** Prompt tokens when the provider reports usage; else undefined. */
  promptTokens?: number;
  /** Completion tokens when the provider reports usage; else undefined. */
  completionTokens?: number;
}

/**
 * Purpose of an LLM call for usage attribution (`llm_usage_log.purpose`).
 * Stored as VARCHAR; never as a raw string literal in write paths.
 */
export enum LlmUsagePurpose {
  CONTENT = 'content',
  ASSISTANT = 'assistant',
}
