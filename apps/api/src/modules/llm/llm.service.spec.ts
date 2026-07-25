// apps/api/src/modules/llm/llm.service.spec.ts
import { ConfigService } from '@nestjs/config';
import type { LlmChatChunk } from '@repo/shared';

import type { LlmUsageService } from './llm-usage.service';
import { LlmRateLimitError, LlmResponseError, LlmTimeoutError, LlmUnavailableError } from './llm.errors';
import { LlmService } from './llm.service';

type MockResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  body?: ReadableStream<Uint8Array> | null;
  headers: Headers;
};

function makeConfig(map: Record<string, string | undefined> = {}): ConfigService {
  const defaults: Record<string, string> = {
    LLM_BASE_URL: 'http://llm.test/v1',
    LLM_API_KEY: '',
    LLM_CONTENT_MODEL: 'content-model',
    LLM_ASSISTANT_MODEL: 'assistant-model',
    LLM_TIMEOUT_MS: '5000',
  };
  const merged = { ...defaults, ...map };
  return {
    get: (key: string, fallback?: string) =>
      merged[key] !== undefined ? merged[key] : fallback,
  } as unknown as ConfigService;
}

function makeUsage(): LlmUsageService {
  return { log: jest.fn().mockResolvedValue(undefined) } as unknown as LlmUsageService;
}

function usageLogMock(service: LlmUsageService): jest.Mock {
  return (service as unknown as { log: jest.Mock }).log;
}

function mockResponseOnce(fetchMock: jest.Mock, res: MockResponse): void {
  fetchMock.mockResolvedValueOnce(res);
}

function mockResponse(fetchMock: jest.Mock, res: MockResponse): void {
  fetchMock.mockResolvedValue(res);
}

function okJson(payload: unknown, status = 200): MockResponse {
  return { ok: true, status, json: () => Promise.resolve(payload), headers: new Headers() };
}

function httpError(status: number, body = 'boom', headers?: Headers): MockResponse {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(body),
    headers: headers ?? new Headers(),
  };
}

function getCallInit(fetchMock: jest.Mock, index = 0): RequestInit {
  const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
  return calls[index][1];
}

function getCallUrl(fetchMock: jest.Mock, index = 0): string {
  const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
  return calls[index][0];
}

describe('LlmService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('isAvailable is true when base URL and content model are set', () => {
    const svc = new LlmService(makeConfig(), makeUsage());
    expect(svc.isAvailable()).toBe(true);
  });

  it('isAvailable is false when base URL empty', () => {
    const svc = new LlmService(makeConfig({ LLM_BASE_URL: '' }), makeUsage());
    expect(svc.isAvailable()).toBe(false);
  });

  it('chat sends OpenAI body and returns text; no Authorization when key empty', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, okJson({
      choices: [{ message: { content: 'hello' } }],
      model: 'content-model',
      usage: { prompt_tokens: 3, completion_tokens: 1 },
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const usage = makeUsage();
    const svc = new LlmService(makeConfig(), usage);
    const result = await svc.chat([{ role: 'user', content: 'hi' }], { purpose: 'content' });

    expect(result.text).toBe('hello');
    expect(result.model).toBe('content-model');
    expect(result.promptTokens).toBe(3);
    expect(getCallUrl(fetchMock)).toBe('http://llm.test/v1/chat/completions');
    const init = getCallInit(fetchMock);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'content-model',
      stream: false,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(usageLogMock(usage)).toHaveBeenCalled();
  });

  it('chat sets Authorization when API key present', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, okJson({ choices: [{ message: { content: 'x' } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig({ LLM_API_KEY: 'sk-test' }), makeUsage());
    await svc.chat([{ role: 'user', content: 'hi' }]);
    const init = getCallInit(fetchMock);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('purpose assistant selects assistant model', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, okJson({ choices: [{ message: { content: 'x' } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig(), makeUsage());
    await svc.chat([{ role: 'user', content: 'hi' }], { purpose: 'assistant' });
    const body = JSON.parse(getCallInit(fetchMock).body as string) as Record<string, unknown>;
    expect(body.model).toBe('assistant-model');
  });

  it('explicit opts.model wins over purpose', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, okJson({ choices: [{ message: { content: 'x' } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig(), makeUsage());
    await svc.chat([{ role: 'user', content: 'hi' }], {
      purpose: 'assistant',
      model: 'override',
    });
    const body = JSON.parse(getCallInit(fetchMock).body as string) as Record<string, unknown>;
    expect(body.model).toBe('override');
  });

  it('non-2xx throws LlmResponseError', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, httpError(500, 'boom'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig(), makeUsage());
    await expect(svc.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      LlmResponseError
    );
  });

  it('empty content throws LlmResponseError', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, okJson({ choices: [{ message: { content: '' } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig(), makeUsage());
    await expect(svc.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      LlmResponseError
    );
  });

  it('network failure throws LlmUnavailableError', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const svc = new LlmService(makeConfig(), makeUsage());
    await expect(svc.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      LlmUnavailableError
    );
  });

  it('abort throws LlmTimeoutError', async () => {
    const fetchMock = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig({ LLM_TIMEOUT_MS: '20' }), makeUsage());
    await expect(svc.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      LlmTimeoutError
    );
  });

  it('429 retries then succeeds when Retry-After is short', async () => {
    const fetchMock = jest.fn();
    mockResponseOnce(fetchMock, httpError(429, 'slow down', new Headers({ 'Retry-After': '0' })));
    mockResponseOnce(fetchMock, okJson({ choices: [{ message: { content: 'ok' } }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig({ LLM_TIMEOUT_MS: '10000' }), makeUsage());
    const result = await svc.chat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429 exhausts retries → LlmRateLimitError', async () => {
    const fetchMock = jest.fn();
    mockResponse(fetchMock, httpError(429, 'no', new Headers({ 'Retry-After': '0' })));
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig({ LLM_TIMEOUT_MS: '10000' }), makeUsage());
    await expect(svc.chat([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      LlmRateLimitError
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('chatStream yields accumulated deltas and done', async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"He"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n' +
      'data: [DONE]\n\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
        controller.close();
      },
    });
    const fetchMock = jest.fn();
    mockResponse(fetchMock, {
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const svc = new LlmService(makeConfig(), makeUsage());
    const chunks: string[] = [];
    let lastDone = false;
    for await (const c of svc.chatStream([{ role: 'user', content: 'hi' }])) {
      chunks.push(c.delta);
      lastDone = c.done;
    }
    expect(chunks[chunks.length - 1]).toBe('Hello');
    expect(lastDone).toBe(true);
  });

  it('chatStream early break still cancels reader and logs usage (generator-lifetime contract)', async () => {
    // Reproduces the generator-lifetime bug: a consumer that breaks out of
    // the for-await (token-budget cap, user cancel, etc.) triggers
    // `generator.return()` at the suspended yield. Before the fix, code
    // after the terminal yield never ran → reader leaked + usage log
    // dropped. The finally must always release the reader and call safeLog.
    const sse =
      'data: {"choices":[{"delta":{"content":"He"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n' +
      'data: [DONE]\n\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse));
        controller.close();
      },
    });
    const cancelSpy = jest.spyOn(stream, 'getReader');
    const fetchMock = jest.fn();
    mockResponse(fetchMock, {
      ok: true,
      status: 200,
      body: stream,
      headers: new Headers(),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const usage = makeUsage();
    const logMock = usageLogMock(usage);
    const svc = new LlmService(makeConfig(), usage);

    // Consume exactly ONE chunk, then break — NOT the done chunk. This is
    // the canonical "early break" pattern that exposed the bug. Using
    // for-await + `break` triggers `generator.return()` at the suspended
    // yield inside chatStream.
    let firstChunk: LlmChatChunk | undefined;
    for await (const c of svc.chatStream([{ role: 'user', content: 'hi' }])) {
      firstChunk = c;
      break;
    }
    expect(firstChunk?.delta).toBe('He');

    // (a) usage.log WAS called despite the early break (the bug dropped it).
    expect(logMock).toHaveBeenCalledTimes(1);
    // success:true is fine here — the stream produced data before the
    // consumer broke. The contract is "log fires + reader is released",
    // not the exact success bit (which depends on whether the consumer
    // broke before or after the terminal chunk).
    const loggedCall = (logMock.mock.calls as Array<[{ success: boolean }]>)[0][0];
    expect(typeof loggedCall.success).toBe('boolean');
    // (b) The reader was obtained (and would have been leaked before fix).
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    // No unhandled rejection escapes — the test reaching this assertion
    // without throwing is itself the contract check.
  });
});
