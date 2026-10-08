import { describe, expect, it } from 'vitest';

import { profitTone, toTopSellerStats, trendTone } from './topSellerCard';

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

  it('tones the revenue change: up positive, down negative, flat or none muted', () => {
    expect(toTopSellerStats(item() as never, t, 'en-US')[0].secondaryTone).toBe('positive');
    expect(toTopSellerStats(item({ change: 0 }) as never, t, 'en-US')[0].secondaryTone).toBeUndefined();
    const down = toTopSellerStats(item({ change: -3.14 }) as never, t, 'en-US')[0];
    expect(down).toMatchObject({ secondary: '−3.1%', secondaryTone: 'negative' });
    expect(toTopSellerStats(item({ change: null }) as never, t, 'en-US')[0].secondaryTone).toBeUndefined();
  });

  it('tones the sparkline: flat or no comparison neutral', () => {
    expect(trendTone(5)).toBe('positive');
    expect(trendTone(-5)).toBe('negative');
    expect(trendTone(0)).toBe('neutral');
    expect(trendTone(null)).toBe('neutral');
  });

  it('a profit of exactly zero is neutral, not green', () => {
    expect(toTopSellerStats(item({ netProfit: 0 }) as never, t, 'en-US')[3].tone).toBeUndefined();
    expect(profitTone(0)).toBeUndefined();
  });

  it('all-provisional: confirmed value stays 0 and neutral, the estimate shows apart', () => {
    const tt = ((key: string, o?: { amount: string }) => (o ? key + ':' + o.amount : key)) as never;
    const stats = toTopSellerStats(item({ netProfit: 0, profitProvisional: 30 }) as never, tt, 'en-US');
    expect(stats[3]).toMatchObject({
      value: '$0.00',
      secondary: 'dashboard.topSellers.estimatedAmount:+$30.00',
    });
    expect(stats[3].tone).toBeUndefined();
  });

  it('mixed: confirmed value with the provisional amount as the muted secondary', () => {
    const tt = ((key: string, o?: { amount: string }) => (o ? key + ':' + o.amount : key)) as never;
    const stats = toTopSellerStats(item({ netProfit: 10, profitProvisional: 30 }) as never, tt, 'en-US');
    expect(stats[3]).toMatchObject({
      value: '+$10.00',
      tone: 'positive',
      secondary: 'dashboard.topSellers.estimatedAmount:+$30.00',
    });
    expect(stats[3].secondaryTone).toBeUndefined();
  });

  it('no provisional profit: no secondary', () => {
    expect(toTopSellerStats(item() as never, t, 'en-US')[3].secondary).toBeUndefined();
  });
});
