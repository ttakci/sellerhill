import { BadRequestException } from '@nestjs/common';
import { DashboardChartGranularity as G, DashboardRangePreset as P } from '@repo/shared';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const AGG = {
  sales: '10', orders: '1', units: '1', refunds: '0', gross_profit: '3', payout: '8',
  profit_confirmed: '2', profit_provisional: '0', revenue_uncosted: '0', orders_pending_capture: '0',
  orders_capture_failed: '0', orders_untracked: '0', cost_of_goods: '5', transaction_fees: '1',
  ad_fees: '0', amazon_shipping: '0', amazon_tax: '0',
};

function make(today = '2026-10-07', timezone = 'Europe/Istanbul') {
  const answer = (sql: string, params: unknown[]): unknown[] => {
    if (sql.includes('now() AT TIME ZONE')) {
      return [{ today }];
    }
    if (sql.includes('WITH ORDINALITY')) {
      return (params[1] as string[]).map((_, i) => ({ idx: String(i + 1), ...AGG }));
    }
    if (sql.includes('GROUPING SETS')) {
      return [
        { ebay_account_id: 's1', is_total: 0, ...AGG },
        { ebay_account_id: null, is_total: 1, ...AGG, sales: '30' },
      ];
    }
    return []; // bucket queries: empty → zero-filled
  };
  const query = jest.fn((sql: string, params: unknown[] = []) => Promise.resolve(answer(sql, params)));
  const timezones = {
    getForUser: jest.fn(() => Promise.resolve(timezone)),
    isValid: jest.fn((name: string) => Promise.resolve(name !== 'Mars/Olympus')),
  };
  return { service: new DashboardService({ query } as never, timezones as never), query, timezones };
}

describe('DashboardService.getDashboard', () => {
  it('anchors on the seller-local today and returns four periods with trends', async () => {
    const { service, query } = make();
    const data = await service.getDashboard('u1', { preset: P.TODAY });
    expect(data.range).toMatchObject({ from: '2026-10-07', to: '2026-10-07', today: '2026-10-07', timezone: 'Europe/Istanbul' });
    expect(data.periods).toHaveLength(4);
    expect(data.periods[0].metrics.trend).toBe(0); // 10 vs 10
    const todaySql = query.mock.calls.find(([sql]) => String(sql).includes('now() AT TIME ZONE'));
    expect(todaySql?.[1]).toEqual(['Europe/Istanbul']);
  });

  it('sends all eight windows (4 periods + 4 comparisons) in ONE aggregate query', async () => {
    const { service, query } = make();
    await service.getDashboard('u1', { preset: P.THIS_MONTH });
    const agg = query.mock.calls.filter(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect(agg).toHaveLength(1);
    expect((agg[0][1] as unknown[])[1]).toHaveLength(8);
  });

  it('zero-fills 24 hourly chart points and one P&L column for today', async () => {
    const { service } = make();
    const data = await service.getDashboard('u1', { preset: P.TODAY });
    expect(data.chart.granularity).toBe(G.HOUR);
    expect(data.chart.points).toHaveLength(24);
    expect(data.pnl.columns).toEqual([expect.objectContaining({ key: '2026-10-07', isCurrent: true })]);
  });

  it('P&L columns are newest first and only the one containing today is current', async () => {
    const { service } = make();
    const data = await service.getDashboard('u1', { preset: P.THIS_MONTH });
    expect(data.pnl.columns[0]).toMatchObject({ key: '2026-10-07', isCurrent: true });
    expect(data.pnl.columns.filter((c) => c.isCurrent)).toHaveLength(1);
  });

  it('judges a custom range against the SELLER’s today, not the server’s (Review Focus 5)', async () => {
    // Seller in Los Angeles; their today is still 10-06.
    const { service } = make('2026-10-06', 'America/Los_Angeles');
    await expect(service.getDashboard('u1', { from: '2026-10-01', to: '2026-10-07' })).rejects.toThrow();
    await expect(service.getDashboard('u1', { from: '2026-10-01', to: '2026-10-06' })).resolves.toBeDefined();
  });
});

describe('e-mail methods', () => {
  it('getDayMetrics is a one-day getRangeMetrics', async () => {
    const { service, query } = make();
    const m = await service.getDayMetrics('u1', '2026-10-06', 'Europe/Istanbul', 's1');
    expect(m.sales).toBe(10);
    const call = query.mock.calls.find(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect(call?.[1]).toEqual(['u1', ['2026-10-06'], ['2026-10-06'], 'Europe/Istanbul', 's1']);
  });

  it('uses the seller\'s stored zone when the timezone is omitted or null', async () => {
    const { service, query, timezones } = make();
    await service.getDayMetrics('u1', '2026-10-06');
    await service.getRangeMetrics('u1', { from: '2026-10-06', to: '2026-10-06' }, null);
    expect(timezones.getForUser).toHaveBeenCalledTimes(2);
    const calls = query.mock.calls.filter(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect(calls.map((c) => (c[1] as unknown[])[3])).toEqual(['Europe/Istanbul', 'Europe/Istanbul']);
  });

  it('falls back to UTC for an unknown supplied zone, never sending it to SQL', async () => {
    const { service, query } = make();
    await service.getDayMetrics('u1', '2026-10-06', 'Mars/Olympus');
    const call = query.mock.calls.find(([sql]) => String(sql).includes('WITH ORDINALITY'));
    expect((call?.[1] as unknown[])[3]).toBe('UTC');
    await service.getRangeMetricsByStore('u1', { from: '2026-10-06', to: '2026-10-06' }, 'Mars/Olympus');
    const byStore = query.mock.calls.find(([sql]) => String(sql).includes('GROUPING SETS'));
    expect((byStore?.[1] as unknown[])[3]).toBe('UTC');
  });

  it('getSellerToday answers the Postgres today of the seller\'s zone', async () => {
    const { service, query } = make('2026-10-06', 'America/Los_Angeles');
    await expect(service.getSellerToday('u1')).resolves.toBe('2026-10-06');
    const todaySql = query.mock.calls.find(([sql]) => String(sql).includes('now() AT TIME ZONE'));
    expect(todaySql?.[1]).toEqual(['America/Los_Angeles']);
  });

  it('getRangeMetricsByStore returns the total row and each store row', async () => {
    const { service } = make();
    const r = await service.getRangeMetricsByStore('u1', { from: '2026-10-06', to: '2026-10-06' }, 'UTC');
    expect(r.total.sales).toBe(30);
    expect(r.stores).toEqual([expect.objectContaining({ ebayAccountId: 's1' })]);
  });
});

describe('DashboardController range parsing', () => {
  const controller = (svc: Partial<DashboardService>) => new DashboardController(svc as DashboardService);
  const req = { user: { sub: 'u1' } };

  it('defaults to today', async () => {
    const getDashboard = jest.fn(() => Promise.resolve({} as never));
    await controller({ getDashboard }).getDashboard(req);
    expect(getDashboard).toHaveBeenCalledWith('u1', { preset: P.TODAY }, undefined);
  });

  it('refuses an unknown preset and a half custom range', async () => {
    const c = controller({ getDashboard: jest.fn() });
    await expect(c.getDashboard(req, 'forever')).rejects.toThrow(BadRequestException);
    await expect(c.getDashboard(req, undefined, '2026-10-01')).rejects.toThrow(BadRequestException);
  });

  it('refuses a repeated query param (an array) with a 400, not a 500', async () => {
    const c = controller({ getDashboard: jest.fn() });
    await expect(c.getDashboard(req, ['today', 'thisWeek'])).rejects.toThrow(BadRequestException);
    await expect(c.getDashboard(req, undefined, ['2026-10-01'], '2026-10-02')).rejects.toThrow(BadRequestException);
    await expect(c.getDashboard(req, undefined, '2026-10-01', ['2026-10-02'])).rejects.toThrow(BadRequestException);
  });
});
