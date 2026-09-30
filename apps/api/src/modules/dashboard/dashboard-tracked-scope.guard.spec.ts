// apps/api/src/modules/dashboard/dashboard-tracked-scope.guard.spec.ts
//
// The dashboard describes the business SellerHill manages, not the whole eBay
// store: every period figure is scoped to TRACKED orders (`listing_id IS NOT
// NULL`). An untracked order — one whose eBay item never matched a SellerHill
// listing — has no product cost and never can, so admitting it inflated Sales /
// Payout with revenue nothing could be earned on and, because its
// `purchase_price` is 0, counted its whole payout as gross profit and ROI.
//
// The scope lives in ONE fragment (`periodSelect`) shared by the period cards,
// the chart and the P&L, so this spec reads that fragment rather than each
// query. The one figure untracked orders may contribute is their COUNT, which
// the card shows as "excluded" so the Orders page and the dashboard never look
// like they disagree.

import * as fs from 'fs';
import * as path from 'path';

function read(...segments: string[]): string {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8')
    .replace(/\r\n/g, '\n');
}

describe('dashboard aggregates are scoped to tracked orders', () => {
  const service = read('modules', 'dashboard', 'dashboard.service.ts');
  const start = service.indexOf('private periodSelect(): string {');
  const body = service.slice(start, service.indexOf('\n  }\n', start));

  it('folds the tracked predicate into the shared live filter', () => {
    // `live` prefixes every non-cancelled aggregate (sales, orders, payout,
    // gross profit, every profit tier, every cost row).
    expect(body).toMatch(/const tracked = 'listing_id IS NOT NULL';/);
    expect(body).toMatch(/const live = `WHERE status <> '\$\{c\}' AND \$\{tracked\}`;/);
  });

  it('scopes refunds the same way, so refund rate compares like with like', () => {
    expect(body).toMatch(/FILTER \(WHERE status = '\$\{c\}' AND \$\{tracked\}\) AS refunds/);
  });

  it('never leaves an aggregate on the unscoped WHERE', () => {
    // Every FILTER either starts from `live`, is the tracked refund count, or is
    // the deliberate untracked count below.
    const filters = body.match(/FILTER \(([^)]*)\)/g) ?? [];
    expect(filters.length).toBeGreaterThan(10);
    for (const f of filters) {
      const scoped =
        f.includes('${live}') ||
        f.includes("WHERE status = '${c}' AND ${tracked}") ||
        f.includes("WHERE status <> '${c}' AND listing_id IS NULL");
      expect(scoped).toBe(true);
    }
  });

  it('counts the excluded untracked orders and nothing else about them', () => {
    expect(body).toMatch(
      /COUNT\(\*\) FILTER \(WHERE status <> '\$\{c\}' AND listing_id IS NULL\) AS orders_untracked/,
    );
    // `revenue_uncosted` used to fold untracked revenue in; those rows are now
    // outside `live`, so listing the status there would be dead code that
    // reads as if the revenue were still counted.
    expect(body).not.toMatch(/OrderCostCaptureStatus\.UNTRACKED/);
  });
});

describe('the dashboard order carousel is scoped the same way', () => {
  const container = fs
    .readFileSync(
      path.join(
        __dirname,
        '..', '..', '..', '..', '..',
        'apps', 'web', 'src', 'features', 'dashboard', 'DashboardPage', 'DashboardPage.container.tsx',
      ),
      'utf8',
    )
    .replace(/\r\n/g, '\n');

  it('asks the orders API for tracked orders only', () => {
    const start = container.indexOf('useGetOrdersQuery({');
    const call = container.slice(start, container.indexOf('});', start));
    expect(call).toMatch(/isTracked: true/);
  });

  it('opens "view all" on the same tracked set', () => {
    expect(container).toMatch(/\/orders\?\$\{buildRangeParams\('dateFrom', 'dateTo'\)\}&tracking=tracked/);
  });
});
