import { createHmac } from 'crypto';

import { ConfigService } from '@nestjs/config';
import { AssistantCursorScope, AssistantErrorCode } from '@repo/shared';

import { AssistantCursorError, AssistantCursorService } from './assistant-cursor.service';

const SECRET = 'cursor-test-secret-at-least-32-bytes';
const NOW = 2_000_000_000;

function config(overrides: Record<string, string | number> = {}): ConfigService {
  const values: Record<string, string | number> = {
    ASSISTANT_CURSOR_SECRET: SECRET,
    ASSISTANT_CURSOR_TTL_SECONDS: 300,
    ASSISTANT_EVENT_RETENTION_DAYS: 7,
    ...overrides,
  };
  return { get: (key: string, fallback?: string | number) => values[key] ?? fallback } as unknown as ConfigService;
}

function signed(payload: Record<string, unknown>, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded, 'ascii').digest('base64url');
  return `${encoded}.${signature}`;
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    sub: 'user-1',
    after: '9223372036854775807',
    iat: NOW,
    exp: NOW + 300,
    scope: AssistantCursorScope.ASSISTANT_EVENTS,
    ...overrides,
  };
}

function expectCode(run: () => unknown, code: AssistantErrorCode): void {
  try {
    run();
    throw new Error('Expected cursor verification to fail');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AssistantCursorError);
    expect((error as AssistantCursorError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

describe('AssistantCursorService', () => {
  const scope = AssistantCursorScope.ASSISTANT_EVENTS;

  it('round-trips a versioned cursor and preserves BIGINT as decimal text', () => {
    const service = new AssistantCursorService(config());
    const cursor = service.issue('user-1', 9_223_372_036_854_775_807n, scope, NOW);
    const encodedPayload = cursor.split('.')[0];
    const raw = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;

    expect(raw.after).toBe('9223372036854775807');
    expect(service.verify(cursor, 'user-1', scope, NOW + 1)).toEqual({
      after: 9_223_372_036_854_775_807n,
      issuedAt: NOW,
      expiresAt: NOW + 300,
    });
  });

  it.each([
    ['payload tamper', () => `${signed(payload()).replace(/^./, 'A')}`],
    ['signature tamper', () => `${signed(payload()).slice(0, -1)}A`],
    ['wrong secret', () => signed(payload(), 'another-secret')],
    ['one part', () => 'abc'],
    ['extra part', () => 'abc.def.ghi'],
    ['invalid alphabet', () => 'abc=.def'],
    ['empty input', () => ''],
  ])('rejects %s generically', (_name, makeCursor) => {
    expectCode(() => new AssistantCursorService(config()).verify(makeCursor(), 'user-1', scope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
  });

  it.each([
    ['foreign subject', signed(payload()), 'user-2', scope],
    ['foreign scope', signed(payload()), 'user-1', 'foreign_scope' as AssistantCursorScope],
  ])('rejects %s without revealing which claim mismatched', (_name, cursor, subject, requestedScope) => {
    expectCode(() => new AssistantCursorService(config()).verify(cursor, subject, requestedScope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
  });

  it.each([
    ['wrong version', { v: 2 }],
    ['unknown scope', { scope: 'unknown' }],
    ['negative after', { after: '-1' }],
    ['non-decimal after', { after: '1e3' }],
    ['leading-zero after', { after: '01' }],
    ['oversized BIGINT', { after: '10000000000000000000' }],
    ['numeric after', { after: 1 }],
    ['fractional iat', { iat: NOW + 0.5 }],
    ['unsafe exp', { exp: Number.MAX_SAFE_INTEGER + 1 }],
    ['non-increasing lifetime', { exp: NOW }],
    ['lifetime beyond configured TTL', { exp: NOW + 301 }],
    ['future issue time', { iat: NOW + 31, exp: NOW + 300 }],
    ['extra property', { extra: true }],
  ])('rejects invalid payload: %s', (_name, override) => {
    expectCode(() => new AssistantCursorService(config()).verify(signed(payload(override)), 'user-1', scope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
  });

  it('returns the resync signal for an expired cursor', () => {
    const claims = payload({ exp: NOW - 1, iat: NOW - 301 });
    expectCode(
      () => new AssistantCursorService(config()).verify(signed(claims), 'user-1', scope, NOW),
      AssistantErrorCode.RESYNC_REQUIRED,
    );
  });

  it('rejects malformed JSON, oversized payloads and oversized cursors', () => {
    const malformedPayload = Buffer.from('{', 'utf8').toString('base64url');
    const malformed = `${malformedPayload}.${createHmac('sha256', SECRET).update(malformedPayload).digest('base64url')}`;
    const large = signed(payload({ sub: 'x'.repeat(900) }));
    const oversized = 'x'.repeat(2049);

    for (const cursor of [malformed, large, oversized]) {
      expectCode(() => new AssistantCursorService(config()).verify(cursor, 'user-1', scope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
    }
  });

  it('rejects invalid issue inputs and invalid configuration', () => {
    const service = new AssistantCursorService(config());
    expectCode(() => service.issue('', 0n, scope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
    expectCode(() => service.issue('user-1', -1n, scope, NOW), AssistantErrorCode.EVENT_CURSOR_INVALID);
    expect(() => new AssistantCursorService(config({ ASSISTANT_CURSOR_TTL_SECONDS: 700_000 }))).toThrow();
    expect(() => new AssistantCursorService(config({ ASSISTANT_CURSOR_SECRET: '' }))).toThrow();
  });
});
