import { describe, expect, it } from 'vitest';

import { toTopSellerStats } from './topSellerCard';

const t = ((key: string) => key) as never;
const item = (over: Partial<{ netProfit: number; profitProvisional: number; change: number | null }> = {}) => ({
  listing: { currency: 'USD' } as never,
  metrics: { sales: 1234.5, units: 7, orders: 6, netProfit: over.netProfit ?? 210.25, profitProvisional: over.profitProvisional ?? 0, ordersPendingCapture: 0 },
  changes: { sales: over.change === undefined ? 12.5 : over.change, units: null, orders: null, netProfit: null },
  series: [],
});

describe('toTopSellerStats', () => {
  it('shows period sales with its % change, units, orders and net profit', () => {
    const stats = toTopSellerStats(item() as never, t, 'en-US');
    expect(stats.map((s) => s.label)).toEqual([
      'dashboard.topSellers.stats.sales', 'dashboard.topSellers.stats.units',
      'dashboard.topSellers.stats.orders', 'dashboard.topSellers.stats.netProfit',
    ]);
    expect(stats[0].value).toBe('$1,234.50');
    expect(stats[0].secondary).toBe('+12.5%');
    expect(stats[3]).toMatchObject({ value: '+$210.25', tone: 'positive' });
  });

  it('marks a loss negative and an unknown change with no secondary', () => {
    const stats = toTopSellerStats(item({ netProfit: -5, change: null }) as never, t, 'en-US');
    expect(stats[0].secondary).toBeUndefined();
    expect(stats[3]).toMatchObject({ tone: 'negative' });
  });

  it('adds the estimated note when part of the profit is provisional', () => {
    const stats = toTopSellerStats(item({ profitProvisional: 3 }) as never, t, 'en-US');
    expect(stats[3].secondary).toBe('dashboard.topSellers.estimated');
  });
});
