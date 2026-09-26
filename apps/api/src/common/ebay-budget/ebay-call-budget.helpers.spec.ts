import { EbayApiResource, EbayCallPriority } from '@repo/shared';

import {
  budgetWindow,
  buildBudgetOverview,
  deferralDelayMs,
  effectiveLimit,
  governedWindows,
} from './ebay-call-budget.helpers';
import { mapRateLimits } from './ebay-rate-limits';

describe('budgetWindow', () => {
  it('keys the counter by UTC calendar day', () => {
    expect(budgetWindow(new Date('2026-08-09T13:45:00.000Z')).day).toBe('2026-08-09');
  });

  it('resets at the next UTC midnight', () => {
    expect(budgetWindow(new Date('2026-08-09T13:45:00.000Z')).resetAt.toISOString()).toBe(
      '2026-08-10T00:00:00.000Z'
    );
  });

  it('gives two instants on the same UTC day the same counter', () => {
    // Two API replicas in different timezones must not each start their own
    // budget — the quota is one pool shared by the whole application.
    const morning = budgetWindow(new Date('2026-08-09T00:00:01.000Z'));
    const night = budgetWindow(new Date('2026-08-09T23:59:59.000Z'));
    expect(morning.day).toBe(night.day);
    expect(morning.resetAt.getTime()).toBe(night.resetAt.getTime());
  });

  it('rolls the day over exactly at midnight UTC', () => {
    expect(budgetWindow(new Date('2026-08-09T23:59:59.999Z')).day).toBe('2026-08-09');
    expect(budgetWindow(new Date('2026-08-10T00:00:00.000Z')).day).toBe('2026-08-10');
  });

  it('keeps the key alive past the reset so it never expires early', () => {
    const window = budgetWindow(new Date('2026-08-09T23:59:00.000Z'));
    expect(window.ttlSeconds).toBeGreaterThan(60);
  });

  it('handles a month boundary', () => {
    expect(budgetWindow(new Date('2026-08-31T22:00:00.000Z')).resetAt.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z'
    );
  });
});

describe('effectiveLimit', () => {
  it('gives interactive calls the full quota', () => {
    expect(effectiveLimit(2_000_000, 5, EbayCallPriority.INTERACTIVE)).toBe(2_000_000);
  });

  it('holds background work below the reserve', () => {
    expect(effectiveLimit(2_000_000, 5, EbayCallPriority.BACKGROUND)).toBe(1_900_000);
  });

  it('applies the reserve to a small quota too', () => {
    // Taxonomy is 5,000/day; the reserve is what keeps a seller's own publish
    // working after the refresh pipeline has run all day.
    expect(effectiveLimit(5_000, 10, EbayCallPriority.BACKGROUND)).toBe(4_500);
  });

  it('treats a zero reserve as no reserve', () => {
    expect(effectiveLimit(1_000, 0, EbayCallPriority.BACKGROUND)).toBe(1_000);
  });

  it('clamps a negative reserve rather than exceeding the real quota', () => {
    expect(effectiveLimit(1_000, -20, EbayCallPriority.BACKGROUND)).toBe(1_000);
  });

  it('clamps an absurd reserve so background work is never fully starved', () => {
    expect(effectiveLimit(1_000, 99, EbayCallPriority.BACKGROUND)).toBe(500);
  });

  it('never returns a fractional ceiling', () => {
    expect(Number.isInteger(effectiveLimit(333, 7, EbayCallPriority.BACKGROUND))).toBe(true);
  });
});

describe('deferralDelayMs', () => {
  it('waits until the quota resets', () => {
    expect(
      deferralDelayMs(new Date('2026-08-10T00:00:00.000Z'), new Date('2026-08-09T23:00:00.000Z'))
    ).toBe(3_600_000);
  });

  it('never returns a delay short enough to busy-loop', () => {
    // Clock skew or a reset that just passed must not turn into a retry storm.
    expect(
      deferralDelayMs(new Date('2026-08-10T00:00:00.000Z'), new Date('2026-08-10T00:00:01.000Z'))
    ).toBe(60_000);
  });
});

describe('governedWindows', () => {
  const now = new Date('2026-09-26T10:00:30.000Z');
  const daily = { limit: 5_000, remaining: 5_000, timeWindowSeconds: 86_400, resetAt: null };
  const minute = { limit: 100, remaining: 100, timeWindowSeconds: 60, resetAt: null };

  it('always returns the daily counter first, even with no eBay figure', () => {
    const [first, ...rest] = governedWindows(null, now);
    expect(first).toMatchObject({ windowSeconds: 86_400, keyParts: ['2026-09-26'], limit: null });
    expect(first.resetAt.toISOString()).toBe('2026-09-27T00:00:00.000Z');
    expect(rest).toEqual([]);
  });

  it('adds one bucketed counter per sub-daily window', () => {
    const windows = governedWindows({ daily, shortWindows: [minute], sourceResource: 'sell.inventory' }, now);
    expect(windows.map((w) => w.limit)).toEqual([5_000, 100]);
    const bucket = Math.floor(now.getTime() / 60_000);
    expect(windows[1]).toMatchObject({ windowSeconds: 60, keyParts: ['w60', String(bucket)], ttlSeconds: 120 });
    expect(windows[1].resetAt.getTime()).toBe((bucket + 1) * 60_000);
  });

  it('moves to a new bucket at the window boundary while the daily key stays', () => {
    const mapped = { daily, shortWindows: [minute], sourceResource: 'sell.inventory' };
    const before = governedWindows(mapped, new Date('2026-09-26T10:00:59.999Z'));
    const after = governedWindows(mapped, new Date('2026-09-26T10:01:00.000Z'));
    expect(after[0].keyParts).toEqual(before[0].keyParts);
    expect(after[1].keyParts).not.toEqual(before[1].keyParts);
  });

  it('keeps a sub-daily-only resource gated by its short window and count-only daily', () => {
    const windows = governedWindows({ daily: null, shortWindows: [minute], sourceResource: 'sell.feed' }, now);
    expect(windows.map((w) => w.limit)).toEqual([null, 100]);
  });
});

describe('buildBudgetOverview', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const counts = Object.fromEntries(Object.values(EbayApiResource).map((r) => [r, 3])) as Record<EbayApiResource, number>;
  const resources = [
    { apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resourceName: 'commerce.taxonomy', windows: [{ limit: 5_000, remaining: 4_100, timeWindowSeconds: 86_400, resetAt: '2026-09-25T20:13:30.000Z' }] },
    { apiContext: 'commerce', apiName: 'Media', apiVersion: 'v1_beta', resourceName: 'Image', windows: [] },
  ];

  it('puts eBay\'s figures beside our count, never a difference', () => {
    const dto = buildBudgetOverview({ snapshot: { resources, fetchedAt: now, mapped: mapRateLimits(resources) }, live: true, counts, reservePercent: 20, now });
    const row = dto.rows.find((r) => r.resource === EbayApiResource.TAXONOMY);
    expect(row).toMatchObject({ ebayLimit: 5_000, ebayRemaining: 4_100, ebayResetAt: '2026-09-25T20:13:30.000Z', ourCount: 3, backgroundLimit: 4_000, ourResetAt: '2026-09-26T00:00:00.000Z' });
    expect(dto.fetchedAt).toBe(now.toISOString());
    expect(dto.unmapped.map((r) => r.resourceName)).toEqual(['Image']);
  });

  it('shows a row for every governed resource even without an eBay figure', () => {
    const dto = buildBudgetOverview({ snapshot: null, live: false, counts, reservePercent: 20, now });
    expect(dto.rows).toHaveLength(Object.values(EbayApiResource).length);
    expect(dto.rows.every((r) => r.ebayLimit === null && r.backgroundLimit === null)).toBe(true);
    expect(dto.fetchedAt).toBeNull();
    expect(dto.unmapped).toEqual([]);
  });

  it('names the governed Trading resource even with no snapshot', () => {
    const dto = buildBudgetOverview({ snapshot: null, live: false, counts, reservePercent: 20, now });
    const row = dto.rows.find((r) => r.resource === EbayApiResource.TRADING_END_ITEM);
    expect(row?.sourceResources).toEqual(['EndItem']);
    expect(row?.partial).toBe(false);
  });
});
