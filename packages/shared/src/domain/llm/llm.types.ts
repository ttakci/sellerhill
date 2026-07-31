/** OpenAI-compatible chat roles. */
export enum LlmMessageRole { SYSTEM = 'system', USER = 'user', ASSISTANT = 'assistant' }
/**
 * What an LLM call was for. Also selects the PROVIDER GROUP: assistant
 * purposes can run on a different (paid) provider than the listing ones,
 * because listing traffic is thousands of calls a day and belongs on a local
 * model, while the customer-facing chatbot is low-volume and quality-critical.
 */
export enum LlmUsagePurpose { CONTENT = 'content', ASPECT = 'aspect', ASSISTANT = 'assistant', ASSISTANT_EMBEDDING = 'assistant_embedding', ASSISTANT_SUMMARY = 'assistant_summary', ASSISTANT_CLASSIFIER = 'assistant_classifier', KNOWLEDGE_INGESTION = 'knowledge_ingestion' }
export enum LlmUsageSource { PROVIDER = 'provider', ESTIMATED = 'estimated', MIXED = 'mixed' }
export enum LlmFinishReason { STOP = 'stop', LENGTH = 'length', CONTENT_FILTER = 'content_filter', TOOL_CALLS = 'tool_calls', UNKNOWN = 'unknown' }
export enum LlmStreamTerminalReason { PROVIDER_DONE = 'provider_done', FINISH_REASON = 'finish_reason', NATURAL_CLOSE = 'natural_close', CALLER_ABORT = 'caller_abort', TIMEOUT = 'timeout', ERROR = 'error' }
export interface LlmMessage { role: `${LlmMessageRole}`; content: string }
export interface LlmTokenUsage { promptTokens: number; completionTokens: number; totalTokens: number; source: LlmUsageSource }
export interface LlmChatOptions { model?: string; purpose?: `${LlmUsagePurpose}`; temperature?: number; maxTokens?: number; timeoutMs?: number; signal?: AbortSignal; userId?: string; conversationId?: string; messageId?: string; generationAttemptId?: string }
/** Streaming chunk; delta is accumulated text. */
export interface LlmChatChunk { delta: string; model: string; done: boolean; terminalObserved?: boolean; terminalReason?: LlmStreamTerminalReason; finishReason?: LlmFinishReason; usage?: LlmTokenUsage }
export interface LlmChatResult { text: string; model: string; promptTokens?: number; completionTokens?: number; totalTokens?: number; usage?: LlmTokenUsage; terminalObserved?: boolean; terminalReason?: LlmStreamTerminalReason; finishReason?: LlmFinishReason }
