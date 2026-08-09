/** OpenAI-compatible chat roles. */
export enum LlmMessageRole { SYSTEM = 'system', USER = 'user', ASSISTANT = 'assistant' }
/**
 * What an LLM call was for. Both purposes run on the single listing-group
 * provider (`LLM_BASE_URL` / `LLM_CONTENT_MODEL`) — there is no second
 * provider group. (There used to be: a paid "assistant" group backed the
 * customer-facing chatbot. That chatbot was replaced by tawk.to in 2026-08 —
 * see CLAUDE.md "Customer support widget — tawk.to" — and the assistant/
 * knowledge-ingestion purposes were removed with it.)
 */
export enum LlmUsagePurpose { CONTENT = 'content', ASPECT = 'aspect' }
export enum LlmUsageSource { PROVIDER = 'provider', ESTIMATED = 'estimated', MIXED = 'mixed' }
export enum LlmFinishReason { STOP = 'stop', LENGTH = 'length', CONTENT_FILTER = 'content_filter', TOOL_CALLS = 'tool_calls', UNKNOWN = 'unknown' }
export enum LlmStreamTerminalReason { PROVIDER_DONE = 'provider_done', FINISH_REASON = 'finish_reason', NATURAL_CLOSE = 'natural_close', CALLER_ABORT = 'caller_abort', TIMEOUT = 'timeout', ERROR = 'error' }
export interface LlmMessage { role: `${LlmMessageRole}`; content: string }
export interface LlmTokenUsage { promptTokens: number; completionTokens: number; totalTokens: number; source: LlmUsageSource }
export interface LlmChatOptions { model?: string; purpose?: `${LlmUsagePurpose}`; temperature?: number; maxTokens?: number; timeoutMs?: number; signal?: AbortSignal; userId?: string }
/** Streaming chunk; delta is accumulated text. */
export interface LlmChatChunk { delta: string; model: string; done: boolean; terminalObserved?: boolean; terminalReason?: LlmStreamTerminalReason; finishReason?: LlmFinishReason; usage?: LlmTokenUsage }
export interface LlmChatResult { text: string; model: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; usage?: LlmTokenUsage; terminalObserved?: boolean; terminalReason?: LlmStreamTerminalReason; finishReason?: LlmFinishReason }
