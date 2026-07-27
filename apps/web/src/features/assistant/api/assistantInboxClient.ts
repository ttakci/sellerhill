import {
  AssistantConnectionStatus,
  AssistantInboxEventType,
  type AssistantInboxEvent,
} from '@repo/shared';

import { createSseParser, type ParsedSseEvent } from './sseParser';

import { authenticatedRequest } from '@/api/authenticatedRequest';
import { refreshAuthSession } from '@/api/authRefreshCoordinator';


export interface AssistantInboxCallbacks {
  onConnectionStatus: (status: AssistantConnectionStatus) => void;
  onEvent: (event: AssistantInboxEvent) => void;
  onResyncRequired: () => void;
}

export interface AssistantInboxOptions {
  accessToken: () => string | null;
  callbacks: AssistantInboxCallbacks;
  cursor?: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export class AssistantInboxClient {
  private controller: AbortController | null = null;
  private cursor: string | null;
  private retryIndex = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  constructor(private readonly options: AssistantInboxOptions) {
    this.cursor = options.cursor ?? null;
  }

  connect(): void {
    this.disconnect();
    this.stopped = false;
    void this.open();
  }

  disconnect(): void {
    this.stopped = true;
    this.controller?.abort();
    this.controller = null;
    if (this.retryTimer) {clearTimeout(this.retryTimer);}
    this.retryTimer = null;
    this.options.callbacks.onConnectionStatus(AssistantConnectionStatus.DISCONNECTED);
  }

  getCursor(): string | null {
    return this.cursor;
  }

  private async open(): Promise<void> {
    if (this.stopped) {return;}
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.options.callbacks.onConnectionStatus(AssistantConnectionStatus.OFFLINE);
      window.addEventListener('online', this.handleOnline, { once: true });
      return;
    }

    this.options.callbacks.onConnectionStatus(this.retryIndex ? AssistantConnectionStatus.RECONNECTING : AssistantConnectionStatus.CONNECTING);
    this.controller = new AbortController();
    const url = new URL(`${API_BASE_URL}/assistant/events`);
    if (this.cursor) {url.searchParams.set('after', this.cursor);}

    try {
      const { response } = await authenticatedRequest(url, { accessToken: this.options.accessToken(), signal: this.controller.signal });
      if (!response.ok || !response.body) {throw new Error(`assistant.inbox.http.${response.status}`);}
      this.options.callbacks.onConnectionStatus(AssistantConnectionStatus.CONNECTED);
      this.retryIndex = 0;
      await this.read(response);
      if (!this.stopped) {this.scheduleReconnect();}
    } catch (error) {
      if (!this.stopped && !(error instanceof DOMException && error.name === 'AbortError')) {this.scheduleReconnect();}
    }
  }

  private async read(response: Response): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    while (!this.stopped) {
      const chunk = await reader.read();
      if (chunk.done) {break;}
      for (const parsed of parser.feed(decoder.decode(chunk.value, { stream: true }))) {
        const event = decodeInboxEvent(parsed);
        if (!event) {continue;}
        if (event.eventType === AssistantInboxEventType.AUTH_EXPIRED) {
          this.options.callbacks.onConnectionStatus(AssistantConnectionStatus.AUTH_EXPIRED);
          await refreshAuthSession();
          return;
        }
        if (event.eventType === AssistantInboxEventType.RESYNC_REQUIRED) {
          this.cursor = null;
          this.options.callbacks.onResyncRequired();
          return;
        }
        if (event.eventType === AssistantInboxEventType.DURABLE_EVENT) {this.cursor = event.cursor;}
        this.options.callbacks.onEvent(event);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) {return;}
    const base = RETRY_DELAYS_MS[Math.min(this.retryIndex, RETRY_DELAYS_MS.length - 1)];
    const jitter = Math.floor(base * 0.2 * Math.random());
    this.retryIndex += 1;
    this.retryTimer = setTimeout(() => void this.open(), base + jitter);
  }

  private readonly handleOnline = (): void => {
    if (!this.stopped) {void this.open();}
  };
}

function decodeInboxEvent(parsed: ParsedSseEvent): AssistantInboxEvent | null {
  if (!parsed.event || !parsed.data) {return null;}
  try {
    const data: unknown = JSON.parse(parsed.data);
    if (!isRecord(data) || data.eventType !== parsed.event) {return null;}
    return data as unknown as AssistantInboxEvent;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
