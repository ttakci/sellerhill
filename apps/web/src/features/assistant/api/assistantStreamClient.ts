import {
  AssistantStreamEventType,
  type AssistantStreamEvent,
  type RetryAssistantMessageRequest,
  type StreamAssistantMessageRequest,
} from '@repo/shared';

import { createSseParser, type ParsedSseEvent } from './sseParser';

import { authenticatedRequest } from '@/api/authenticatedRequest';


export interface AssistantStreamOptions {
  accessToken: string | null;
  conversationId: string;
  onEvent: (event: AssistantStreamEvent) => void;
  request: StreamAssistantMessageRequest;
  signal?: AbortSignal;
}

export interface AssistantRetryStreamOptions {
  accessToken: string | null;
  conversationId: string;
  onEvent: (event: AssistantStreamEvent) => void;
  request: RetryAssistantMessageRequest;
  signal?: AbortSignal;
  userMessageId: string;
}

export interface AssistantStreamResult {
  assistantMessageCompleted: boolean;
  streamCompleted: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export function streamAssistantMessage(options: AssistantStreamOptions): Promise<AssistantStreamResult> {
  return openStream(
    `${API_BASE_URL}/assistant/conversations/${options.conversationId}/messages/stream`,
    options.request,
    options.accessToken,
    options.onEvent,
    options.signal
  );
}

export function retryAssistantMessage(options: AssistantRetryStreamOptions): Promise<AssistantStreamResult> {
  return openStream(
    `${API_BASE_URL}/assistant/conversations/${options.conversationId}/messages/${options.userMessageId}/retry-stream`,
    options.request,
    options.accessToken,
    options.onEvent,
    options.signal
  );
}

async function openStream(
  url: string,
  body: StreamAssistantMessageRequest | RetryAssistantMessageRequest,
  accessToken: string | null,
  onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal
): Promise<AssistantStreamResult> {
  const { response } = await authenticatedRequest(url, {
    accessToken,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal,
  });
  if (!response.ok || !response.body) {throw new Error(`assistant.stream.http.${response.status}`);}

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let assistantMessageCompleted = false;
  let streamCompleted = false;

  const consume = (parsed: ParsedSseEvent[]) => {
    for (const item of parsed) {
      const event = decodeEvent(item);
      if (!event) {continue;}
      onEvent(event);
      if (event.eventType === AssistantStreamEventType.ASSISTANT_MESSAGE_COMPLETED) {assistantMessageCompleted = true;}
      if (event.eventType === AssistantStreamEventType.STREAM_COMPLETED) {streamCompleted = true;}
    }
  };

  let reading = true;
  while (reading) {
    const chunk = await reader.read();
    if (chunk.done) {
      reading = false;
    } else {
      consume(parser.feed(decoder.decode(chunk.value, { stream: true })));
    }
  }
  consume(parser.feed(decoder.decode()));
  consume(parser.flush());

  return { assistantMessageCompleted, streamCompleted };
}

function decodeEvent(parsed: ParsedSseEvent): AssistantStreamEvent | null {
  if (!parsed.event || !parsed.data) {return null;}
  try {
    const data: unknown = JSON.parse(parsed.data);
    if (!isRecord(data) || data.eventType !== parsed.event) {return null;}
    return data as unknown as AssistantStreamEvent;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
