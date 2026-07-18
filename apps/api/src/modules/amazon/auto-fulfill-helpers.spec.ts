import { AutoFulfillStatus } from '@repo/shared';

import {
  meetsCoarseCapGate,
  pickRoundRobinAccount,
  shouldSkipFulfillStart,
  proxySessionToken,
} from './auto-fulfill-helpers';

describe('meetsCoarseCapGate', () => {
  it('passes when sale_total within cap', () => {
    expect(meetsCoarseCapGate(40, 50)).toBe(true);
  });
  it('passes at exact cap', () => {
    expect(meetsCoarseCapGate(50, 50)).toBe(true);
  });
  it('fails when over cap', () => {
    expect(meetsCoarseCapGate(60, 50)).toBe(false);
  });
  it('fails when cap is null (auto disabled)', () => {
    expect(meetsCoarseCapGate(40, null)).toBe(false);
  });
  it('fails when sale_total is zero/negative', () => {
    expect(meetsCoarseCapGate(0, 50)).toBe(false);
  });
});

describe('pickRoundRobinAccount', () => {
  const mk = (id: string, ts: number | null) => ({ id, lastUsedAt: ts === null ? null : new Date(ts) });
  it('returns null for empty pool', () => {
    expect(pickRoundRobinAccount([])).toBeNull();
  });
  it('picks the oldest lastUsedAt', () => {
    const pool = [mk('A', 300), mk('B', 100), mk('C', 200)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('treats null lastUsedAt as oldest (0)', () => {
    const pool = [mk('A', 100), mk('B', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('breaks ties by id ascending', () => {
    const pool = [mk('B', null), mk('A', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('A');
  });
});

describe('shouldSkipFulfillStart', () => {
  it('skips terminal states (no double-order / no retry of deliberate stop)', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PLACED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.BLOCKED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.DRY_RUN)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.SKIPPED)).toBe(true);
  });
  it('allows (re)start on pending/running/failed', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PENDING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.RUNNING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.FAILED)).toBe(false);
  });
});

describe('proxySessionToken', () => {
  it('perUser strategy uses userId', () => {
    expect(proxySessionToken('perUser', 'u1', 'a1')).toBe('u1');
  });
  it('perAccount strategy uses accountId', () => {
    expect(proxySessionToken('perAccount', 'u1', 'a1')).toBe('a1');
  });
});
