import { DashboardChartGranularity as G, DashboardRangePreset as P, TopListingSortKey as S } from '@repo/shared';

import { DashboardService } from './dashboard.service';

const AGG = (sales: string, orders = '1') => ({
  sales, orders, units: orders, refunds: '0', gross_profit: '3', payout: '8', profit_confirmed: '2',
  profit_provisional: '0', revenue_uncosted: '0', orders_pending_capture: '0', orders_capture_failed: '0',
  orders_untracked: '0', cost_of_goods: '5', transaction_fees: '1', ad_fees: '0', amazon_shipping: '0', amazon_tax: '0',
});

function make(rankRows: unknown[], bucketRows: unknown[] = [], countTotal?: string) {
  const query = jest.fn((sql: string, _params: unknown[] = []) => {
    if (sql.includes('now() AT TIME ZONE')) {
      return Promise.resolve([{ today: '2026-10-07' }]);
    }
    if (sql.includes('WITH cur AS')) {
      return Promise.resolve(rankRows);
    }
    if (sql.includes('SELECT COUNT(*)')) {
      return Promise.resolve([{ total: countTotal ?? '0' }]);
    }
    if (sql.includes('ANY(')) {
      return Promise.resolve(bucketRows);
    }
    return Promise.resolve([]);
  });
  const timezones = { getForUser: jest.fn(() => Promise.resolve('Europe/Istanbul')), isValid: jest.fn(() => Promise.resolve(true)) };
  return { service: new DashboardService({ query } as never, timezones as never), query };
}

const rank = (id: string, sales: string, prevSales: string | null, total = '2') => ({
  listing_id: id, cur: AGG(sales), prev: prevSales === null ? null : AGG(prevSales), total,
});

describe('DashboardService.getTopListings', () => {
  it('ranks with R and the comparison window, pages, and reports the total', async () => {
    const { service, query } = make([rank('l1', '30', '20'), rank('l2', '10', null)]);
    const page = await service.getTopListings('u1', { preset: P.THIS_MONTH }, S.SALES, 1, 20);
    const call = query.mock.calls.find(([sql]) => String(sql).includes('WITH cur AS'))!;
    expect(call[1]).toEqual(['u1', '2026-10-01', '2026-10-07', '2026-09-01', '2026-09-07', 'Europe/Istanbul', 20, 0]);
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => r.listingId)).toEqual(['l1', 'l2']);
    expect(page.rows[0].changes.sales).toBe(50);
    expect(page.rows[1].changes.sales).toBeNull();
    expect(page.granularity).toBe(G.DAY);
    expect(page.seriesKeys).toHaveLength(7);
  });

  it('excludes listings that only have cancelled orders and filters tracked orders', async () => {
    const { service, query } = make([]);
    await service.getTopListings('u1', { preset: P.TODAY }, S.SALES, 1, 20);
    const sql = String(query.mock.calls.find(([s]) => String(s).includes('WITH cur AS'))![0]);
    expect(sql).toMatch(/listing_id IS NOT NULL/);
    expect(sql).toMatch(/cur\.orders\s*>\s*0/);
    expect(sql).toMatch(/buildLocalRangeSql|order_date >= /);
  });

  it.each([
    [S.SALES, 'cur.sales'],
    [S.UNITS, 'cur.units'],
    [S.ORDERS, 'cur.orders'],
    [S.NET_PROFIT, 'cur.profit_confirmed'],
    [S.CHANGE, 'NULLIF(prev.sales, 0)'],
  ])('sorts by %s', async (sortBy, fragment) => {
    const { service, query } = make([]);
    await service.getTopListings('u1', { preset: P.TODAY }, sortBy, 1, 20);
    const sql = String(query.mock.calls.find(([s]) => String(s).includes('WITH cur AS'))![0]);
    expect(sql).toContain(fragment);
    expect(sql).toMatch(/DESC NULLS LAST, cur\.listing_id/);
  });

  it('applies the store filter to both windows', async () => {
    const { service, query } = make([]);
    await service.getTopListings('u1', { preset: P.TODAY }, S.SALES, 2, 10, 'store-1');
    const call = query.mock.calls.find(([s]) => String(s).includes('WITH cur AS'))!;
    expect((String(call[0]).match(/ebay_account_id = \$7/g) ?? []).length).toBe(2);
    expect(call[1]).toEqual(['u1', '2026-10-07', '2026-10-07', '2026-10-06', '2026-10-06', 'Europe/Istanbul', 'store-1', 10, 10]);
  });

  it('builds the sort-metric series for the page ids, zero-filled', async () => {
    const { service, query } = make(
      [rank('l1', '30', '20', '1')],
      [{ listing_id: 'l1', period: '2026-10-07 09', ...AGG('12') }],
    );
    const page = await service.getTopListings('u1', { preset: P.TODAY }, S.SALES, 1, 20);
    expect(page.seriesKeys).toHaveLength(24);
    expect(page.rows[0].series[9]).toBe(12);
    expect(page.rows[0].series.filter((v) => v !== 0)).toHaveLength(1);
    const bucketCall = query.mock.calls.find(([s]) => String(s).includes('ANY('))!;
    expect(bucketCall[1]).toContainEqual(['l1']);
  });

  it('skips the series query when the page is empty (page beyond the last)', async () => {
    const { service, query } = make([]);
    const page = await service.getTopListings('u1', { preset: P.TODAY }, S.SALES, 99, 20);
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
    expect(query.mock.calls.some(([s]) => String(s).includes('ANY('))).toBe(false);
  });

  it('counts separately when an out-of-range page is empty', async () => {
    const { service } = make([], [], '41');
    const page = await service.getTopListings('u1', { preset: P.TODAY }, S.SALES, 3, 20);
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(41);
  });
});
