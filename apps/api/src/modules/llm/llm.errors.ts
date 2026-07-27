// apps/api/src/modules/llm/llm.errors.ts

export class LlmError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class LlmUnavailableError extends LlmError {
  constructor(message = 'LLM provider unreachable') {
    super(message, 'llm_unavailable');
  }
}

export class LlmTimeoutError extends LlmError {
  constructor(message = 'LLM request timed out') {
    super(message, 'llm_timeout');
  }
}

export class LlmAbortError extends LlmError {
  constructor(message = 'LLM request aborted by caller') {
    super(message, 'llm_aborted');
  }
}

export class LlmResponseError extends LlmError {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message, 'llm_response');
    this.status = status;
  }
}

export class LlmRateLimitError extends LlmError {
  readonly retryAfterMs?: number;
  constructor(message = 'LLM rate limited', retryAfterMs?: number) {
    super(message, 'llm_rate_limit');
    this.retryAfterMs = retryAfterMs;
  }
}
