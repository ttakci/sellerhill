// apps/api/src/modules/ebay-returns/return-sweep-interval.spec.ts

import {
  resolveReturnSweepInterval,
  RETURN_SWEEP_MAX_INTERVAL_HOURS,
  RETURN_SWEEP_MIN_INTERVAL_HOURS,
} from './return-sweep-interval';

// Production figures (getRateLimits, 2026-09-30): 5,000 calls a day, of which
// background work may spend 95% (the default 5% interactive reserve).
const CEILING = 4750;

const auto = (activeStores: number, over: Partial<Parameters<typeof resolveReturnSweepInterval>[0]> = {}) =>
  resolveReturnSweepInterval({
    autoEnabled: true,
    manualIntervalHours: 6,
    activeStores,
    dailyCeiling: CEILING,
    quotaSharePercent: 50,
    ...over,
  });

describe('resolveReturnSweepInterval', () => {
  it('reads a handful of stores every hour', () => {
    expect(auto(1)).toEqual({ intervalHours: 1, source: 'auto', estimatedDailyCalls: 24 });
    expect(auto(50).intervalHours).toBe(1);
    // 98 stores × 24 = 2,352 calls, just inside the 2,375 budget.
    expect(auto(98).intervalHours).toBe(1);
  });

  it('stretches the interval as stores grow, so the daily calls stay inside the share', () => {
    const budget = Math.floor(CEILING / 2);
    for (const stores of [99, 100, 250, 500, 1000, 2000, 5000]) {
      const resolved = auto(stores);
      expect(resolved.source).toBe('auto');
      expect(resolved.estimatedDailyCalls).toBeLessThanOrEqual(budget);
      // …and it is the SHORTEST whole-hour interval that fits.
      if (resolved.intervalHours > RETURN_SWEEP_MIN_INTERVAL_HOURS) {
        expect(Math.ceil((stores * 24) / (resolved.intervalHours - 1))).toBeGreaterThan(budget);
      }
    }
  });

  it('lands on six hours at the 500-store target', () => {
    expect(auto(500)).toEqual({ intervalHours: 6, source: 'auto', estimatedDailyCalls: 2000 });
  });

  it('never exceeds the maximum, even when the quota cannot cover the stores', () => {
    const resolved = auto(1_000_000);
    expect(resolved.intervalHours).toBe(RETURN_SWEEP_MAX_INTERVAL_HOURS);
  });

  it('treats no stores as the minimum interval and no calls', () => {
    expect(auto(0)).toEqual({ intervalHours: 1, source: 'auto', estimatedDailyCalls: 0 });
    expect(auto(Number.NaN).intervalHours).toBe(1);
    expect(auto(-3).intervalHours).toBe(1);
  });

  it('a larger share shortens the interval, a smaller one lengthens it', () => {
    expect(auto(500, { quotaSharePercent: 90 }).intervalHours).toBe(3);
    expect(auto(500, { quotaSharePercent: 25 }).intervalHours).toBe(11);
  });

  it('clamps the share to 1–100 percent', () => {
    expect(auto(500, { quotaSharePercent: 500 }).intervalHours).toBe(auto(500, { quotaSharePercent: 100 }).intervalHours);
    expect(auto(500, { quotaSharePercent: -10 }).intervalHours).toBe(auto(500, { quotaSharePercent: 1 }).intervalHours);
    expect(auto(500, { quotaSharePercent: Number.NaN }).intervalHours).toBe(
      auto(500, { quotaSharePercent: 1 }).intervalHours
    );
  });

  it('sweeps as rarely as allowed when the share buys no call at all', () => {
    expect(auto(10, { dailyCeiling: 50, quotaSharePercent: 1 }).intervalHours).toBe(RETURN_SWEEP_MAX_INTERVAL_HOURS);
  });

  it('falls back to the manual value while eBay has reported no limit', () => {
    for (const dailyCeiling of [null, 0, -1, Number.NaN]) {
      expect(auto(500, { dailyCeiling })).toEqual({
        intervalHours: 6,
        source: 'manual_no_limit',
        estimatedDailyCalls: 2000,
      });
    }
  });

  it('uses the manual value when auto is off, whatever the quota says', () => {
    expect(auto(5000, { autoEnabled: false, manualIntervalHours: 2 })).toEqual({
      intervalHours: 2,
      source: 'manual',
      estimatedDailyCalls: 60000,
    });
  });

  it('keeps a manual value inside the bounds and whole', () => {
    expect(auto(1, { autoEnabled: false, manualIntervalHours: 0 }).intervalHours).toBe(1);
    expect(auto(1, { autoEnabled: false, manualIntervalHours: 2.2 }).intervalHours).toBe(3);
    expect(auto(1, { autoEnabled: false, manualIntervalHours: 9999 }).intervalHours).toBe(168);
    expect(auto(1, { autoEnabled: false, manualIntervalHours: Number.NaN }).intervalHours).toBe(168);
  });
});
