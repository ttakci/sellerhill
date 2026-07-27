import {
  fairSplitBalances,
  fairSplitTokens,
  KeepaUsageSource,
  UsageEventSource,
  UsageMetric,
} from '@repo/shared';

import { buildKeepaUsageEvents } from './keepa-projection';

describe('fairSplitTokens', () => {
  it('returns empty when no users', () => {
    expect(fairSplitTokens(10, [])).toEqual([]);
  });

  it('returns empty for non-finite or negative totals', () => {
    expect(fairSplitTokens(Number.NaN, ['u1'])).toEqual([]);
    expect(fairSplitTokens(-1, ['u1'])).toEqual([]);
  });

  it('de-duplicates and sorts user ids', () => {
    const alloc = fairSplitTokens(3, ['u3', 'u1', 'u2', 'u1']);
    expect(alloc.map((a) => a.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(alloc.every((a) => a.tokens === 1)).toBe(true);
  });

  it('splits evenly when divisible', () => {
    const alloc = fairSplitTokens(9, ['u1', 'u2', 'u3']);
    expect(alloc.map((a) => a.tokens)).toEqual([3, 3, 3]);
    expect(fairSplitBalances(9, alloc)).toBe(true);
  });

  it('distributes residue deterministically to the first users', () => {
    const alloc = fairSplitTokens(10, ['u1', 'u2', 'u3']);
    expect(alloc.map((a) => a.tokens)).toEqual([3.334, 3.333, 3.333]);
    expect(fairSplitBalances(10, alloc)).toBe(true);
  });

  it('balances exactly for awkward fractions', () => {
    const alloc = fairSplitTokens(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(fairSplitBalances(1, alloc)).toBe(true);
  });
});

describe('buildKeepaUsageEvents', () => {
  const baseArgs = {
    sourceLogId: 'keepa-log-1',
    asin: 'B0XYZ',
    keepaSource: KeepaUsageSource.REFRESH,
  };

  it('returns no events when tokens <= 0', () => {
    expect(buildKeepaUsageEvents({ ...baseArgs, tokens: 0, userIds: ['u1'] })).toEqual([]);
  });

  it('returns a single platform-level event when no users', () => {
    const events = buildKeepaUsageEvents({ ...baseArgs, tokens: 5, userIds: [] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: UsageEventSource.KEEPA,
      metric: UsageMetric.KEEPA_TOKENS,
      providerRefId: 'keepa-log-1',
      userId: null,
      quantity: 5,
      estimatedCostMicros: null,
      currency: null,
    });
  });

  it('returns one event per user with fair-share quantities summing to total', () => {
    const events = buildKeepaUsageEvents({ ...baseArgs, tokens: 9, userIds: ['u1', 'u2', 'u3'] });
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.source === UsageEventSource.KEEPA)).toBe(true);
    expect(events.every((e) => e.metric === UsageMetric.KEEPA_TOKENS)).toBe(true);
    const sum = events.reduce((acc, e) => acc + e.quantity, 0);
    expect(Math.abs(sum - 9) < 0.0001).toBe(true);
    expect(events.every((e) => e.estimatedCostMicros === null)).toBe(true);
  });

  it('preserves the Keepa source in metadata', () => {
    const events = buildKeepaUsageEvents({
      ...baseArgs,
      tokens: 2,
      userIds: ['u1'],
      keepaSource: KeepaUsageSource.CREATE,
    });
    expect(events[0].metadata).toMatchObject({ keepaSource: KeepaUsageSource.CREATE, asin: 'B0XYZ' });
  });
});
