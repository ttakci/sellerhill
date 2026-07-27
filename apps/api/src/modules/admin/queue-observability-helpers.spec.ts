// apps/api/src/modules/admin/queue-observability-helpers.spec.ts
//
// Pure-helper tests for queue observability. Mirrors the finops-helpers.spec.ts
// pattern: import functions directly, no Nest setup, deterministic fixtures.
// Covers the shared node-free helpers (resolveRetentionDays,
// redactPayloadToAllowlist, stampJobData, extractCorrelationId) and the
// API-side computePayloadHash.

import {
  PAYLOAD_HASH_ALLOWLIST,
  QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS,
  QueueEventType,
  QueueObservabilityRetentionKind,
  redactPayloadToAllowlist,
  resolveRetentionDays,
  stampJobData,
  extractCorrelationId,
  generateCorrelationId,
} from '@repo/shared';

import { computePayloadHash } from './queue-observability.helpers';

describe('resolveRetentionDays', () => {
  it('returns the default when undefined', () => {
    expect(resolveRetentionDays(undefined)).toBe(QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS);
  });

  it('returns the default when null', () => {
    expect(resolveRetentionDays(null)).toBe(QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS);
  });

  it('returns the default for NaN', () => {
    expect(resolveRetentionDays(Number.NaN)).toBe(QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS);
  });

  it('returns the default for non-positive values', () => {
    expect(resolveRetentionDays(0)).toBe(QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS);
    expect(resolveRetentionDays(-5)).toBe(QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS);
  });

  it('clamps to the minimum (1)', () => {
    expect(resolveRetentionDays(1)).toBe(1);
    expect(resolveRetentionDays(0.5)).toBe(QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS);
  });

  it('clamps to the maximum (90)', () => {
    expect(resolveRetentionDays(90)).toBe(90);
    expect(resolveRetentionDays(365)).toBe(QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS);
  });

  it('floors fractional values within range', () => {
    expect(resolveRetentionDays(7.9)).toBe(7);
    expect(resolveRetentionDays(14.99)).toBe(14);
  });

  it('accepts a typical value of 7', () => {
    expect(resolveRetentionDays(7)).toBe(7);
  });
});

describe('redactPayloadToAllowlist', () => {
  it('returns an empty object for null/undefined/non-object', () => {
    expect(redactPayloadToAllowlist(null)).toEqual({});
    expect(redactPayloadToAllowlist(undefined)).toEqual({});
    expect(redactPayloadToAllowlist('not-an-object')).toEqual({});
    expect(redactPayloadToAllowlist(42)).toEqual({});
    expect(redactPayloadToAllowlist([])).toEqual({});
  });

  it('keeps only allowlisted scalar fields and drops everything else', () => {
    const payload = {
      asin: 'B0XYZ',
      ebayOrderId: 'o-1',
      correlationId: 'corr-1',
      secret: 'should-not-appear',
      bigBody: { nested: 'no' },
      list: [1, 2, 3],
      productId: 'p-1',
      userId: 'u-1',
      amazonAccountId: 'a-1',
      listingSettingsGroupId: 'g-1',
      causationJobId: 'parent-1',
    };
    const redacted = redactPayloadToAllowlist(payload);
    expect(Object.keys(redacted).sort()).toEqual(
      [
        'asin',
        'ebayOrderId',
        'correlationId',
        'productId',
        'userId',
        'amazonAccountId',
        'listingSettingsGroupId',
        'causationJobId',
      ].sort(),
    );
    expect(redacted).not.toHaveProperty('secret');
    expect(redacted).not.toHaveProperty('bigBody');
    expect(redacted).not.toHaveProperty('list');
  });

  it('drops nested objects/arrays even when their key is allowlisted', () => {
    const payload = { correlationId: { nested: 'no' }, asin: ['no'] };
    const redacted = redactPayloadToAllowlist(payload);
    expect(redacted).toEqual({}); // non-scalar values dropped
  });

  it('preserves null and primitive values', () => {
    const redacted = redactPayloadToAllowlist({ asin: null, userId: 0, ebayOrderId: '' });
    expect(redacted).toEqual({ asin: null, userId: 0, ebayOrderId: '' });
  });

  it('uses the default allowlist when none passed', () => {
    expect(PAYLOAD_HASH_ALLOWLIST.length).toBeGreaterThan(0);
    const redacted = redactPayloadToAllowlist({ correlationId: 'c-1', junk: 'x' });
    expect(redacted).toEqual({ correlationId: 'c-1' });
  });

  it('respects a custom allowlist', () => {
    const redacted = redactPayloadToAllowlist({ a: 1, b: 2 }, ['a']);
    expect(redacted).toEqual({ a: 1 });
  });
});

describe('computePayloadHash', () => {
  it('returns null for an empty projection', () => {
    expect(computePayloadHash({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(computePayloadHash(null as unknown as Record<string, never>)).toBeNull();
  });

  it('is deterministic — same fields, same hash regardless of key order', () => {
    const a = computePayloadHash({ asin: 'B0X', correlationId: 'c-1' });
    const b = computePayloadHash({ correlationId: 'c-1', asin: 'B0X' });
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it('is a 64-char hex string', () => {
    const hash = computePayloadHash({ asin: 'B0X' });
    expect(hash).not.toBeNull();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when a value changes', () => {
    const a = computePayloadHash({ asin: 'B0X' });
    const b = computePayloadHash({ asin: 'B0Y' });
    expect(a).not.toBe(b);
  });

  it('treats string vs number distinctly', () => {
    expect(computePayloadHash({ userId: 1 })).not.toBe(computePayloadHash({ userId: '1' }));
  });
});

describe('stampJobData', () => {
  it('adds a correlationId when none exists', () => {
    const stamped = stampJobData({ asin: 'B0X' }, 'c-1');
    expect(stamped).toEqual({ asin: 'B0X', correlationId: 'c-1' });
  });

  it('preserves an existing correlationId when no override passed', () => {
    const stamped = stampJobData({ asin: 'B0X', correlationId: 'existing' });
    expect(stamped).toEqual({ asin: 'B0X', correlationId: 'existing' });
  });

  it('overrides when an explicit non-null id is passed', () => {
    const stamped = stampJobData({ asin: 'B0X', correlationId: 'old' }, 'new');
    expect(stamped.correlationId).toBe('new');
  });

  it('does not set correlationId when value is empty/null', () => {
    const stamped = stampJobData({ asin: 'B0X' }, '');
    expect(stamped).toEqual({ asin: 'B0X' });
    expect('correlationId' in stamped).toBe(false);
  });

  it('preserves all other data fields', () => {
    const data = { userId: 'u-1', asin: 'B0X', listingSettingsGroupId: 'g-1' };
    const stamped = stampJobData(data, 'c-1');
    expect(stamped.userId).toBe('u-1');
    expect(stamped.asin).toBe('B0X');
    expect(stamped.listingSettingsGroupId).toBe('g-1');
    expect(stamped.correlationId).toBe('c-1');
  });
});

describe('extractCorrelationId', () => {
  it('reads the correlationId from job.data', () => {
    expect(extractCorrelationId({ data: { correlationId: 'c-1' } })).toBe('c-1');
  });

  it('returns null when absent', () => {
    expect(extractCorrelationId({ data: { asin: 'B0X' } })).toBeNull();
  });

  it('returns null when data is absent', () => {
    expect(extractCorrelationId({})).toBeNull();
    expect(extractCorrelationId({ data: undefined })).toBeNull();
  });

  it('returns null for a non-string value', () => {
    expect(extractCorrelationId({ data: { correlationId: 42 } })).toBeNull();
    expect(extractCorrelationId({ data: { correlationId: null } })).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractCorrelationId({ data: { correlationId: '' } })).toBeNull();
  });

  it('returns null for null/undefined job', () => {
    expect(extractCorrelationId(null)).toBeNull();
    expect(extractCorrelationId(undefined)).toBeNull();
  });
});

describe('generateCorrelationId', () => {
  it('produces a non-empty string', () => {
    const id = generateCorrelationId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  // Uniqueness is a property of the underlying uuid v4 implementation; the jest
  // test shim mocks uuid, so we don't assert uniqueness here. The shared package
  // re-exports `v4` from uuid directly.
});

describe('QueueEventType enum', () => {
  it('has the two terminal events', () => {
    expect(QueueEventType.COMPLETED).toBe('completed');
    expect(QueueEventType.FAILED).toBe('failed');
  });
});

describe('QueueObservabilityRetentionKind enum', () => {
  it('has the by_age strategy', () => {
    expect(QueueObservabilityRetentionKind.BY_AGE).toBe('by_age');
  });
});
