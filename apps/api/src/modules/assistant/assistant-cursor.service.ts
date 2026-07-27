import { createHmac, timingSafeEqual } from 'crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantCursorScope, AssistantErrorCode } from '@repo/shared';

const CURSOR_VERSION = 1;
const CURSOR_PARTS = 2;
const DEFAULT_TTL_SECONDS = 86_400;
const DEFAULT_RETENTION_DAYS = 7;
const MAX_CURSOR_BYTES = 2_048;
const MAX_PAYLOAD_BYTES = 1_024;
const MAX_SUBJECT_BYTES = 256;
const MAX_BIGINT_DECIMAL_DIGITS = 19;
const SECONDS_PER_DAY = 86_400;
const CLOCK_SKEW_SECONDS = 30;

interface CursorPayload {
  v: number;
  sub: string;
  after: string;
  iat: number;
  exp: number;
  scope: AssistantCursorScope;
}

export interface VerifiedAssistantCursor {
  after: bigint;
  issuedAt: number;
  expiresAt: number;
}

export class AssistantCursorError extends Error {
  constructor(readonly code: AssistantErrorCode.EVENT_CURSOR_INVALID | AssistantErrorCode.RESYNC_REQUIRED) {
    super(code);
    this.name = AssistantCursorError.name;
  }
}

@Injectable()
export class AssistantCursorService {
  private readonly secret: Buffer;
  private readonly ttlSeconds: number;
  private readonly retentionSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('ASSISTANT_CURSOR_SECRET');
    if (!secret) {
      throw new Error('ASSISTANT_CURSOR_SECRET is required');
    }

    this.secret = Buffer.from(secret, 'utf8');
    this.ttlSeconds = this.readPositiveInteger('ASSISTANT_CURSOR_TTL_SECONDS', DEFAULT_TTL_SECONDS);
    this.retentionSeconds =
      this.readPositiveInteger('ASSISTANT_EVENT_RETENTION_DAYS', DEFAULT_RETENTION_DAYS) * SECONDS_PER_DAY;

    if (this.ttlSeconds > this.retentionSeconds) {
      throw new Error('ASSISTANT_CURSOR_TTL_SECONDS must not exceed event retention');
    }
  }

  issue(subject: string, after: bigint, scope: AssistantCursorScope, nowSeconds = this.nowSeconds()): string {
    if (!this.validSubject(subject) || !this.validAfter(after) || !this.validTimestamp(nowSeconds)) {
      throw this.invalid();
    }

    const payload: CursorPayload = {
      v: CURSOR_VERSION,
      sub: subject,
      after: after.toString(10),
      iat: nowSeconds,
      exp: nowSeconds + this.ttlSeconds,
      scope,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload).toString('base64url')}`;
  }

  verify(
    cursor: string,
    subject: string,
    scope: AssistantCursorScope,
    nowSeconds = this.nowSeconds(),
  ): VerifiedAssistantCursor {
    if (
      typeof cursor !== 'string' ||
      Buffer.byteLength(cursor, 'utf8') > MAX_CURSOR_BYTES ||
      !this.validSubject(subject) ||
      !this.validTimestamp(nowSeconds)
    ) {
      throw this.invalid();
    }

    const parts = cursor.split('.');
    if (parts.length !== CURSOR_PARTS || !parts[0] || !parts[1]) {
      throw this.invalid();
    }

    const [encodedPayload, encodedSignature] = parts;
    const expectedSignature = this.sign(encodedPayload);
    const signature = this.decodeBase64Url(encodedSignature, expectedSignature.length);
    if (!signature || !timingSafeEqual(signature, expectedSignature)) {
      throw this.invalid();
    }

    const payloadBuffer = this.decodeBase64Url(encodedPayload, MAX_PAYLOAD_BYTES);
    if (!payloadBuffer) {
      throw this.invalid();
    }

    const payload = this.parsePayload(payloadBuffer);
    if (
      payload.v !== CURSOR_VERSION ||
      payload.sub !== subject ||
      payload.scope !== scope ||
      !Object.values(AssistantCursorScope).includes(payload.scope) ||
      !this.validTimestamp(payload.iat) ||
      !this.validTimestamp(payload.exp) ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > this.ttlSeconds ||
      payload.iat > nowSeconds + CLOCK_SKEW_SECONDS
    ) {
      throw this.invalid();
    }

    if (payload.exp <= nowSeconds || nowSeconds - payload.iat > this.retentionSeconds) {
      throw new AssistantCursorError(AssistantErrorCode.RESYNC_REQUIRED);
    }

    if (!/^\d{1,19}$/.test(payload.after)) {
      throw this.invalid();
    }

    const after = BigInt(payload.after);
    if (after.toString(10) !== payload.after || !this.validAfter(after)) {
      throw this.invalid();
    }

    return { after, issuedAt: payload.iat, expiresAt: payload.exp };
  }

  private parsePayload(payload: Buffer): CursorPayload {
    try {
      const parsed: unknown = JSON.parse(payload.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw this.invalid();
      }
      const value = parsed as Record<string, unknown>;
      const keys = Object.keys(value);
      const expectedKeys = ['after', 'exp', 'iat', 'scope', 'sub', 'v'];
      if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => keys.includes(key))) {
        throw this.invalid();
      }
      if (
        typeof value.v !== 'number' ||
        typeof value.sub !== 'string' ||
        typeof value.after !== 'string' ||
        typeof value.iat !== 'number' ||
        typeof value.exp !== 'number' ||
        typeof value.scope !== 'string'
      ) {
        throw this.invalid();
      }
      return value as unknown as CursorPayload;
    } catch (error: unknown) {
      if (error instanceof AssistantCursorError) {
        throw error;
      }
      throw this.invalid();
    }
  }

  private decodeBase64Url(value: string, maxBytes: number): Buffer | null {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      return null;
    }
    try {
      const decoded = Buffer.from(value, 'base64url');
      if (decoded.length === 0 || decoded.length > maxBytes || decoded.toString('base64url') !== value) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  private sign(payload: string): Buffer {
    return createHmac('sha256', this.secret).update(payload, 'ascii').digest();
  }

  private validSubject(subject: string): boolean {
    return subject.length > 0 && Buffer.byteLength(subject, 'utf8') <= MAX_SUBJECT_BYTES;
  }

  private validAfter(after: bigint): boolean {
    return after >= 0n && after.toString(10).length <= MAX_BIGINT_DECIMAL_DIGITS;
  }

  private validTimestamp(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0;
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = this.configService.get<number>(key, fallback);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    return value;
  }

  private invalid(): AssistantCursorError {
    return new AssistantCursorError(AssistantErrorCode.EVENT_CURSOR_INVALID);
  }

  private nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }
}
