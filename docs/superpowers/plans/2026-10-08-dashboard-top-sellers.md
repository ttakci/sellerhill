# Dashboard Top Sellers Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fourth dashboard tab, "En çok satanlar / Top sellers", listing the listings that sold in the shared date range, ranked (default) by revenue, in the Listings page's card/table format with a per-row sparkline.

**Architecture:** `DashboardService.getTopListings` aggregates tracked orders per listing over the resolved range and its comparison window with the cards' own `periodSelect` fragment and local-day bounds, ranks and pages in SQL, and builds a per-listing bucket series. A small controller in `ListingsModule` (path `dashboard/top-listings`) hydrates the page's listing ids through a new `ListingsService.getListingsByIds` (same mapper as the Listings page) — `ListingsModule` imports `DashboardModule`, never the reverse, so no module cycle. The web adds a `Sparkline` atom, a `trend` slot on `ListingCard`, and a `TopSellersPanel` using the Listings page's `DataTable` pattern.

**Tech Stack:** NestJS 10 + raw `pg` (Postgres 16), React 18 + RTK Query + Emotion, Jest (api; shared from `dist/cjs`), Vitest (web).

**Spec:** `docs/superpowers/specs/2026-10-08-dashboard-top-sellers-design.md`

## Global Constraints

- Range parsing, seller time zone and validation are the dashboard's own (`parseRangeInput`, `TimezoneService`, `resolveDashboardRange`); invalid range → 400 `dashboard.errors.invalidRange`.
- Listed = listings with ≥1 tracked (`listing_id IS NOT NULL`), non-cancelled order in R, for the active store; period figures from the shared `periodSelect` fragment; bounds via `buildLocalRangeSql`; never `CURRENT_DATE`.
- `sortBy` ∈ `sales` (default) · `units` · `orders` · `netProfit` · `change`; unknown → 400 `dashboard.errors.invalidSort`; ties break on `listing_id`; `change` = sales % change vs `periods[0].comparison`, nulls last.
- Pagination: `page` ≥ 1, `limit` default 20, max 100.
- Net profit = confirmed (linked) only; `profitProvisional ≠ 0` shows an "estimated" note.
- `changes` use the cards' rule: null when the previous value is 0.
- `series` = the sort metric per bucket (change → sales), aligned to `seriesKeys` (`dashboardBucketKeys(range, chartGranularity)`), zero-filled.
- Web: Listings page `DataTable` pattern (cards default, `gridMinItemWidth="27rem"`, `gridMaxColumns={2}`, resultLabel, sort picker, pagination, skeleton); `ListingCard` anatomy unchanged apart from the new optional `trend` slot; money two decimals in the listing's currency.
- Repo rules: 4-file split for every web component; tokens via `tkn()`; no hardcoded strings (i18n in all 16 locales: en tr ru hi ur ar az bn de fr es it ro uk zh pt; plural suffixes per CLAUDE.md "Plurals"); `@repo/ui` never imports `@repo/shared`; design-system primitives only.
- Shared tree (other sessions commit here): stage by explicit path, never `git add -A`, never stash; commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A listing whose only orders in R are cancelled** — must not be listed (it sold nothing). Test in Task 1 (SQL has `WHERE (cur ->> 'orders')::int > 0` or equivalent; spec asserts the filter text).
2. **A listing that sold in R but was deleted/ended** — ended (INACTIVE) is listed with its badge; a hard-deleted row (no `listings` row any more) cannot be hydrated and must be dropped from `items` without breaking `total`/page math being visibly wrong. Test in Task 1 (hydration skips missing ids; total stays the SQL count).
3. **Page beyond the last page** (`page=99`) — returns `items: []` with the real `total`, never 500. Test in Task 1.
4. **Sort `change` with no comparison sales** — null changes sort after every real change, including negative ones. Test in Task 1 (SQL expression uses `NULLIF(prev.sales, 0)` and `DESC NULLS LAST`).
5. **Single-bucket or all-zero series** (Today with one sale hour; a listing selling nothing in some buckets) — the sparkline draws a flat baseline or a line, never NaN/blank. Test in Task 2.

---

### Task 1: API — aggregation, controller, hydration

**Files:**
- Modify: `packages/shared/src/domain/dashboard/dashboard.types.ts` (types below + `DashboardTab.TOP_SELLERS`)
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts` (`getTopListings`)
- Modify: `apps/api/src/modules/dashboard/dashboard.controller.ts` (export `parseRangeInput`, `parseStoreId`, `isRangeError` for reuse)
- Create: `apps/api/src/modules/listings/top-listings.controller.ts`
- Modify: `apps/api/src/modules/listings/listings.service.ts` (`getListingsByIds`), `apps/api/src/modules/listings/listings.module.ts` (import `DashboardModule`, register controller)
- Modify: `packages/shared/src/i18n/resources/*/dashboard.json` (`dashboard.errors.invalidSort`)
- Test: `apps/api/src/modules/dashboard/dashboard-top-listings.spec.ts`, `apps/api/src/modules/listings/top-listings.controller.spec.ts`

**Interfaces — Produces (shared):**

```ts
export enum DashboardTab { CARDS = 'cards', CHART = 'chart', PNL = 'pnl', TOP_SELLERS = 'topSellers' }

export enum TopListingSortKey {
  SALES = 'sales',
  UNITS = 'units',
  ORDERS = 'orders',
  NET_PROFIT = 'netProfit',
  CHANGE = 'change',
}
export const DEFAULT_TOP_LISTING_SORT = TopListingSortKey.SALES;
export const TOP_LISTINGS_DEFAULT_LIMIT = 20;
export const TOP_LISTINGS_MAX_LIMIT = 100;

export interface TopListingMetrics {
  sales: number;
  units: number;
  orders: number;
  /** Confirmed (linked) net profit only — the cards' trust rule. */
  netProfit: number;
  profitProvisional: number;
  ordersPendingCapture: number;
}

export interface TopListingChanges {
  sales: number | null;
  units: number | null;
  orders: number | null;
  netProfit: number | null;
}

/** One ranked row before hydration (what DashboardService returns). */
export interface TopListingAggregate {
  listingId: string;
  metrics: TopListingMetrics;
  changes: TopListingChanges;
  series: number[];
}

export interface TopListingsAggregatePage {
  range: DashboardRangeDto;
  sortBy: TopListingSortKey;
  granularity: DashboardChartGranularity;
  seriesKeys: string[];
  rows: TopListingAggregate[];
  total: number;
  page: number;
  limit: number;
}

export interface TopListingDto extends Omit<TopListingAggregate, 'listingId'> {
  listing: ListingDto;
}

export interface TopListingsPageDto extends Omit<TopListingsAggregatePage, 'rows'> {
  items: TopListingDto[];
}
```

(`ListingDto` import from the listings domain; check the shared barrel to avoid a circular import — type-only imports are fine.)

**Interfaces — Produces (API):**
- `DashboardService.getTopListings(userId: string, input: DashboardRangeInput, sortBy: TopListingSortKey, page: number, limit: number, ebayAccountId?: string): Promise<TopListingsAggregatePage>`
- `ListingsService.getListingsByIds(userId: string, ids: string[]): Promise<ListingDto[]>`
- `GET /v1/dashboard/top-listings?range|from&to&ebayAccountId&sortBy&page&limit` → `TopListingsPageDto`

- [ ] **Step 1: Failing service spec** — `dashboard-top-listings.spec.ts`, fake DB answering by SQL markers (copy the pattern of `dashboard.service.spec.ts`):

```ts
import { DashboardChartGranularity as G, DashboardRangePreset as P, TopListingSortKey as S } from '@repo/shared';

import { DashboardService } from './dashboard.service';

const AGG = (sales: string, orders = '1') => ({
  sales, orders, units: orders, refunds: '0', gross_profit: '3', payout: '8', profit_confirmed: '2',
  profit_provisional: '0', revenue_uncosted: '0', orders_pending_capture: '0', orders_capture_failed: '0',
  orders_untracked: '0', cost_of_goods: '5', transaction_fees: '1', ad_fees: '0', amazon_shipping: '0', amazon_tax: '0',
});

function make(rankRows: unknown[], bucketRows: unknown[] = []) {
  const query = jest.fn((sql: string) => {
    if (sql.includes('now() AT TIME ZONE')) return Promise.resolve([{ today: '2026-10-07' }]);
    if (sql.includes('WITH cur AS')) return Promise.resolve(rankRows);
    if (sql.includes('ANY(')) return Promise.resolve(bucketRows);
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
});
```

Note on the empty-page total: with `COUNT(*) OVER ()` an out-of-range page returns no rows, so `total` would read 0. Run a separate `SELECT COUNT(*)` only when the page is empty and `page > 1` (keeps the common path at one statement) — add a spec case: `make([])` with page 3 and a fake answering `SELECT COUNT(*)` with `[{ total: '41' }]` → `total` 41.

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard-top-listings` → FAIL.

- [ ] **Step 2: Shared types** — add the block above to `dashboard.types.ts`; `pnpm --filter @repo/shared build`.

- [ ] **Step 3: `getTopListings`** in `dashboard.service.ts` (reuse `periodSelect`, `num`, `round`, `calcChange`, `emptyAggregate`, `BUCKET_SQL`, `getLocalToday`):

```ts
interface TopRankRow {
  listing_id: string;
  cur: PeriodAggregateRow;
  prev: PeriodAggregateRow | null;
  total: string | number;
}
interface TopBucketRow extends PeriodAggregateRow {
  listing_id: string;
  period: string;
}

/** Sort expression per key — enum-keyed, never user text. */
const TOP_SORT_SQL: Record<TopListingSortKey, string> = {
  [TopListingSortKey.SALES]: 'cur.sales',
  [TopListingSortKey.UNITS]: 'cur.units',
  [TopListingSortKey.ORDERS]: 'cur.orders',
  [TopListingSortKey.NET_PROFIT]: 'cur.profit_confirmed',
  [TopListingSortKey.CHANGE]: '(cur.sales - prev.sales) / NULLIF(prev.sales, 0)',
};

/** Which aggregate column the sparkline draws for each sort. */
const TOP_SERIES_FIELD: Record<TopListingSortKey, keyof PeriodAggregateRow> = {
  [TopListingSortKey.SALES]: 'sales',
  [TopListingSortKey.UNITS]: 'units',
  [TopListingSortKey.ORDERS]: 'orders',
  [TopListingSortKey.NET_PROFIT]: 'profit_confirmed',
  [TopListingSortKey.CHANGE]: 'sales',
};

  /**
   * The listings that sold in the range, ranked. Same tracked scope, same
   * local-day bounds and same periodSelect fragment as the cards, so a
   * listing's figures add up with them.
   */
  async getTopListings(
    userId: string,
    input: DashboardRangeInput,
    sortBy: TopListingSortKey,
    page: number,
    limit: number,
    ebayAccountId?: string,
  ): Promise<TopListingsAggregatePage> {
    const timezone = await this.timezoneService.getForUser(userId);
    const today = await this.getLocalToday(timezone);
    const resolved = resolveDashboardRange(input, today); // DashboardRangeError → 400 in the controller
    const comparison = resolved.periods[0].comparison;
    const offset = (page - 1) * limit;

    const params: QueryParam[] = [
      userId, resolved.range.from, resolved.range.to, comparison.from, comparison.to, timezone,
    ];
    let store = '';
    if (ebayAccountId) {
      params.push(ebayAccountId);
      store = ` AND ebay_account_id = $${params.length}`;
    }
    const limitParam = params.push(limit);
    const offsetParam = params.push(offset);

    const windowSql = (from: string, to: string) => `
      SELECT listing_id, ${this.periodSelect()}
      FROM orders
      WHERE user_id = $1 AND listing_id IS NOT NULL
        AND ${buildLocalRangeSql('order_date', from, to, '$6')}${store}
      GROUP BY listing_id`;

    const rows = await this.databaseService.query<TopRankRow>(
      `WITH cur AS (${windowSql('$2', '$3')}),
            prev AS (${windowSql('$4', '$5')})
       SELECT cur.listing_id, to_jsonb(cur) AS cur, to_jsonb(prev) AS prev, COUNT(*) OVER () AS total
       FROM cur LEFT JOIN prev ON prev.listing_id = cur.listing_id
       WHERE cur.orders > 0
       ORDER BY ${TOP_SORT_SQL[sortBy]} DESC NULLS LAST, cur.listing_id
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    let total = rows.length > 0 ? this.num(rows[0].total) : 0;
    if (rows.length === 0 && page > 1) {
      total = await this.countTopListings(userId, resolved.range, timezone, ebayAccountId);
    }

    const seriesKeys = dashboardBucketKeys(resolved.range, resolved.chartGranularity);
    const series = rows.length
      ? await this.topListingSeries(userId, rows.map((r) => r.listing_id), resolved.range,
          resolved.chartGranularity, timezone, TOP_SERIES_FIELD[sortBy], seriesKeys, ebayAccountId)
      : new Map<string, number[]>();

    return {
      range: {
        preset: resolved.preset, from: resolved.range.from, to: resolved.range.to, today, timezone,
        chartGranularity: resolved.chartGranularity, pnlGranularity: resolved.pnlGranularity,
      },
      sortBy,
      granularity: resolved.chartGranularity,
      seriesKeys,
      rows: rows.map((r) => this.toTopAggregate(r, series.get(r.listing_id) ?? seriesKeys.map(() => 0))),
      total,
      page,
      limit,
    };
  }
```

Plus private helpers:
- `countTopListings(...)` → `SELECT COUNT(*) AS total FROM (SELECT listing_id FROM orders WHERE user_id = $1 AND listing_id IS NOT NULL AND <R bounds> <store> GROUP BY listing_id HAVING COUNT(*) FILTER (WHERE status <> '${OrderStatus.CANCELLED}') > 0) t`.
- `topListingSeries(...)`: `SELECT listing_id, to_char(date_trunc('${unit}', order_date AT TIME ZONE $4::text), '${format}') AS period, ${this.periodSelect()} FROM orders WHERE user_id = $1 AND listing_id = ANY($5::uuid[]) AND ${buildLocalRangeSql('order_date', '$2', '$3', '$4')}${store} GROUP BY listing_id, 2` (store at `$6`), then per listing `seriesKeys.map((k) => round(num(row?.[field] ?? 0)))`. Check `listings.id`'s real type (`\d listings` in local psql); if it is not uuid, cast to `text[]` instead.
- `toTopAggregate(row, series)`: `metrics` from `cur` (`sales` rounded, `units`, `orders`, `netProfit = round(profit_confirmed)`, `profitProvisional`, `ordersPendingCapture`); `changes` = `calcChange(cur.x, prev?.x ?? 0)` per field (sales, units, orders, profit_confirmed).

- [ ] **Step 4: `getListingsByIds`** in `ListingsService` — same SELECT columns as `getListings` (copy the column list: `l.*, p.image_urls, p.category AS product_category, p.stock AS source_stock, p.stock_status AS source_stock_status, p.last_successful_refresh_at AS last_synced_at, (p.source_removed_at IS NOT NULL) AS source_removed, p.brand, ea.marketplace_id AS ebay_marketplace_id, (SELECT MAX(o.order_date) FROM orders o WHERE o.listing_id = l.id) AS last_sale_at`) with `FROM listings l LEFT JOIN products p ON l.product_id = p.id LEFT JOIN ebay_accounts ea ON ea.id = l.ebay_account_id WHERE l.user_id = $1 AND l.id = ANY($2::uuid[])`, mapped with `mapListingRow`. Empty `ids` → `[]` without a query. Better: extract the shared column list into a private constant used by both `getListings` and `getListingsByIds` so they cannot drift.

- [ ] **Step 5: Controller** — in `dashboard.controller.ts` export `parseRangeInput`, `parseStoreId`, `isRangeError` (no behaviour change). Create `apps/api/src/modules/listings/top-listings.controller.ts`:

```ts
@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class TopListingsController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly listingsService: ListingsService,
  ) {}

  @Get('top-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listings that sold in the date range, ranked' })
  async getTopListings(
    @Request() req: { user: { sub: string } },
    @Query('range') range?: unknown,
    @Query('from') from?: unknown,
    @Query('to') to?: unknown,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('sortBy') sortBy?: unknown,
    @Query('page') page?: unknown,
    @Query('limit') limit?: unknown,
  ): Promise<TopListingsPageDto> {
    const input = parseRangeInput(range, from, to);
    const sort = parseSort(sortBy);
    const pageNo = clampInt(page, 1, 1, Number.MAX_SAFE_INTEGER);
    const size = clampInt(limit, TOP_LISTINGS_DEFAULT_LIMIT, 1, TOP_LISTINGS_MAX_LIMIT);
    let aggregates: TopListingsAggregatePage;
    try {
      aggregates = await this.dashboardService.getTopListings(
        req.user.sub, input, sort, pageNo, size, parseStoreId(ebayAccountId),
      );
    } catch (error) {
      if (isRangeError(error)) {
        throw new BadRequestException('dashboard.errors.invalidRange');
      }
      throw error;
    }
    const listings = await this.listingsService.getListingsByIds(
      req.user.sub, aggregates.rows.map((r) => r.listingId),
    );
    const byId = new Map(listings.map((l) => [l.id, l]));
    const { rows, ...rest } = aggregates;
    return {
      ...rest,
      // A listing deleted after it sold cannot be shown; total stays the SQL count.
      items: rows.flatMap(({ listingId, ...row }) => {
        const listing = byId.get(listingId);
        return listing ? [{ ...row, listing }] : [];
      }),
    };
  }
}
```

with local `parseSort(value: unknown): TopListingSortKey` (undefined/'' → `DEFAULT_TOP_LISTING_SORT`; non-string or unknown → 400 `dashboard.errors.invalidSort`) and `clampInt(value, fallback, min, max)` (non-string/NaN → fallback; clamp). Register it in `ListingsModule.controllers` and add `DashboardModule` to `ListingsModule.imports` with a comment ("Dashboard imports nothing from listings, so no cycle — module-cycle.guard.spec.ts proves it").

- [ ] **Step 6: Controller spec** — `top-listings.controller.spec.ts`: defaults (preset today, sort sales, page 1, limit 20) passed to the service; `limit=500` clamps to 100; `sortBy=price` → 400; repeated `sortBy` array → 400; a range error → 400 `dashboard.errors.invalidRange`; hydration keeps aggregate order and drops an id `getListingsByIds` did not return while keeping `total`.

- [ ] **Step 7: i18n** — `dashboard.errors.invalidSort` in all 16 `dashboard.json` (EN "That sort order is not available.", TR "Bu sıralama kullanılamıyor.").

- [ ] **Step 8: Run** — `pnpm --filter @repo/shared build; pnpm --filter api test -- dashboard-top-listings top-listings.controller dashboard.service module-cycle; pnpm --filter api exec tsc --noEmit`. The `module-cycle.guard.spec.ts` (in `modules/admin/`) must pass. Then `PREPARE` the ranking, count and series statements against local Postgres (container `sellerhill_postgres`, creds in `apps/api/.env`; if unavailable record "not run") — or capture the SQL via a quick node-pg script with real params and execute it against the local DB.

- [ ] **Step 9: Commit** — stage the files above by path; message `feat(dashboard): top-listings API — listings that sold in the range, ranked, with a per-bucket series`. (`apps/web` may not type-check until Task 3 if `DashboardTab` exhaustiveness bites — it should not, the tab list is explicit; verify with `pnpm --filter web exec tsc --noEmit`.)

---

### Task 2: `Sparkline` atom + `ListingCard` trend slot

**Files:**
- Create: `packages/ui/src/atoms/Sparkline/{Sparkline.component.tsx,Sparkline.style.ts,Sparkline.types.ts,index.ts}`, `packages/ui/src/utils/sparkline.ts`
- Modify: `packages/ui/src/index.ts`, `packages/ui/src/utils/index.ts` (if utils have a barrel)
- Modify: `apps/web/src/domain-ui/ListingCard/{ListingCard.types.ts,ListingCard.component.tsx,ListingCard.style.ts}`
- Test: `apps/web/src/utils/sparkline.test.ts`

**Interfaces — Produces:**
- `buildSparklinePoints(values: number[], width: number, height: number, padding?: number): string` (SVG `points` attribute, viewBox units)
- `<Sparkline values={number[]} tone?: 'positive' | 'negative' | 'neutral' ariaLabel?: string size?: 'sm' | 'md' />`
- `ListingCardProps.trend?: React.ReactNode`

- [ ] **Step 1: Failing Vitest** — `apps/web/src/utils/sparkline.test.ts`:

```ts
import { buildSparklinePoints } from '@repo/ui';
import { describe, expect, it } from 'vitest';

const parse = (points: string) => points.split(' ').map((p) => p.split(',').map(Number));

describe('buildSparklinePoints', () => {
  it('spreads points across the width and scales max to the top', () => {
    const pts = parse(buildSparklinePoints([0, 5, 10], 100, 30, 0));
    expect(pts).toEqual([[0, 30], [50, 15], [100, 0]]);
  });

  it('draws a flat baseline for all zeros', () => {
    const pts = parse(buildSparklinePoints([0, 0, 0, 0], 100, 30, 0));
    expect(new Set(pts.map(([, y]) => y))).toEqual(new Set([30]));
  });

  it('draws a flat mid line for a constant non-zero series and for a single point', () => {
    expect(new Set(parse(buildSparklinePoints([4, 4, 4], 100, 30, 0)).map(([, y]) => y))).toEqual(new Set([15]));
    const single = parse(buildSparklinePoints([7], 100, 30, 0));
    expect(single).toEqual([[0, 15], [100, 15]]);
  });

  it('handles negatives (net profit) by scaling between min and max', () => {
    const pts = parse(buildSparklinePoints([-10, 0, 10], 100, 20, 0));
    expect(pts.map(([, y]) => y)).toEqual([20, 10, 0]);
  });

  it('returns no NaN for an empty series', () => {
    expect(buildSparklinePoints([], 100, 30, 0)).toBe('0,30 100,30');
  });
});
```

Run: `pnpm --filter @repo/ui build; pnpm --filter web test -- sparkline` → FAIL.

- [ ] **Step 2: `packages/ui/src/utils/sparkline.ts`**

```ts
/**
 * Polyline points for a sparkline in viewBox units (x 0…width, y 0…height,
 * y grows downward). Scales between the series' min and max; a series with no
 * spread (all zeros, a constant, a single point) is drawn flat — at the
 * baseline when it is zero, mid-height otherwise — never NaN.
 */
export function buildSparklinePoints(values: number[], width: number, height: number, padding = 1): string {
  const top = padding;
  const bottom = height - padding;
  const mid = (top + bottom) / 2;
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  if (values.length === 0) {
    return `0,${fmt(bottom)} ${fmt(width)},${fmt(bottom)}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    const y = max === 0 ? bottom : mid;
    return `0,${fmt(y)} ${fmt(width)},${fmt(y)}`;
  }
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => `${fmt(i * step)},${fmt(bottom - ((v - min) / (max - min)) * (bottom - top))}`)
    .join(' ');
}
```

Export from `packages/ui/src/index.ts`.

- [ ] **Step 3: `Sparkline` atom** (stateless: component + style + types):

```ts
// Sparkline.types.ts
export type SparklineTone = 'positive' | 'negative' | 'neutral';
export interface SparklineProps {
  values: number[];
  tone?: SparklineTone;
  /** Accessible description (already translated); without it the chart is decorative. */
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}
```

```tsx
// Sparkline.component.tsx — viewBox 100×32, stretched to the box; stroke stays 1.5px.
const VIEW_W = 100;
const VIEW_H = 32;
export const Sparkline = ({ values, tone = 'neutral', ariaLabel, size = 'md', className }: SparklineProps) => (
  <S.Svg
    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
    preserveAspectRatio="none"
    $tone={tone}
    $size={size}
    role={ariaLabel ? 'img' : undefined}
    aria-label={ariaLabel}
    aria-hidden={ariaLabel ? undefined : true}
    className={className}
  >
    <S.Line points={buildSparklinePoints(values, VIEW_W, VIEW_H, 2)} />
  </S.Svg>
);
```

```ts
// Sparkline.style.ts
export const Svg = styled.svg<{ $tone: SparklineTone; $size: 'sm' | 'md' }>`
  display: block;
  width: 100%;
  height: ${({ $size }) => ($size === 'sm' ? '1.5rem' : '2rem')};
  color: ${({ $tone, theme }) =>
    $tone === 'positive' ? theme.colors.semantic.success : $tone === 'negative' ? theme.colors.semantic.error : theme.colors.text.tertiary};
  overflow: visible;
`;
export const Line = styled.polyline`
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
`;
```

Check the theme paths (`colors.semantic.success/error`, `colors.text.tertiary`) exist; use the nearest tokens if not. If the frontend-rules hook rejects raw `svg` in a component, it already allows it in `packages/ui` atoms (Icon renders SVG) — follow the Icon atom's pattern.

- [ ] **Step 4: `ListingCard` trend slot** — `trend?: React.ReactNode` in `ListingCardProps` (doc: "a small chart above the figures row, e.g. a period sparkline"); in the component render `{trend ? <S.Trend>{trend}</S.Trend> : null}` directly above `<S.Footer>`; `S.Trend` in the style file: `padding: 0 ${tkn('spacing.md')} ${tkn('spacing.sm')};` (mirror the card's horizontal inset — read `ListingCard.style.ts` for the exact token). Nothing else on the card changes.

- [ ] **Step 5: Run + commit** — `pnpm --filter @repo/ui build; pnpm --filter web test -- sparkline; pnpm typecheck; pnpm lint`. Commit `feat(ui): Sparkline atom; ListingCard trend slot`.

---

### Task 3: Web — Top sellers tab, URL state, demo, i18n

**Files:**
- Modify: `apps/web/src/features/dashboard/api/dashboardApi.ts` (`getTopListings`)
- Modify: `apps/web/src/features/dashboard/hooks/useDashboardUrlState.ts` (+ test), `apps/web/src/features/dashboard/dashboard.types.ts`
- Modify: `apps/web/src/features/dashboard/DashboardPage/{container,component,types}` (tab + panel props)
- Create: `apps/web/src/features/dashboard/components/TopSellersPanel/{TopSellersPanel.container.tsx,TopSellersPanel.component.tsx,TopSellersPanel.style.ts,TopSellersPanel.types.ts,index.ts}`
- Create: `apps/web/src/features/dashboard/utils/topSellerCard.ts` (+ `topSellerCard.test.ts`), `apps/web/src/features/dashboard/hooks/useTopSellersColumns.tsx`
- Modify: `apps/web/src/features/demo/demoData.ts`, `apps/web/src/features/demo/demoBaseQuery.ts`
- Modify: `packages/shared/src/i18n/resources/*/dashboard.json`

**Interfaces — Consumes:** Task 1 types/endpoint; Task 2 `Sparkline`, `ListingCardProps.trend`; existing `toListingCardProps(listing, t, locale)` (`features/listings/shared/listing-card.mapper.ts`), `ProductTableCell` (`domain-ui`), `DataTable` (`@repo/ui`).

**Interfaces — Produces:**
- `useGetTopListingsQuery({ range, ebayAccountId, sortBy, page, limit })`
- URL state additions: `topSort: TopListingSortKey`, `topPage: number`, `setTopSort`, `setTopPage` (`?tsort=` default `sales` omitted; `?tpage=` default 1 omitted; `setRange` and `setTopSort` reset `tpage`)
- `toTopSellerStats(item: TopListingDto, t, locale): ListingCardStat[]`

- [ ] **Step 1: Failing tests** —
  - `useDashboardUrlState.test.ts` additions: defaults `topSort === 'sales'`, `topPage === 1`; `?tsort=units&tpage=3` reads back; unknown `tsort` → sales; `setTopSort` removes `tpage`; `setRange` removes `tpage`; default sort is omitted from the URL.
  - `topSellerCard.test.ts`:

```ts
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
```

Run: `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm --filter web test -- useDashboardUrlState topSellerCard` → FAIL.

- [ ] **Step 2: `utils/topSellerCard.ts`** — `formatCurrency(value, locale, listing.currency || 'USD', 2)` (`@repo/ui`); sales secondary = signed `formatPercent`-style `+12.5%` / `−3.1%` from `changes.sales` (undefined when null) — reuse the dashboard formatter's trend formatting if it is importable, else a local helper; net profit value signed (`+`/`−`), tone positive ≥ 0 / negative < 0; secondary on net profit = `t('dashboard.topSellers.estimated')` when `profitProvisional !== 0`. Units/orders via `Intl.NumberFormat(locale)`.

- [ ] **Step 3: API slice** — `getTopListings: builder.query<TopListingsPageDto, GetTopListingsArgs>` with params built like `getDashboard` plus `sortBy`, `page`, `limit`; `providesTags: ['Dashboard']`.

- [ ] **Step 4: URL state** — add `tsort`/`tpage` per the interface; extend `DashboardUrlState` type; keep existing behaviour; reuse `DEFAULT_TOP_LISTING_SORT`.

- [ ] **Step 5: `TopSellersPanel`** —
  - Container props: `range: DashboardRangeInput`, `ebayAccountId?: string`, `sortBy`, `page`, `onSortChange`, `onPageChange`, `locale`, `onOpenListing(id)`. It calls `useGetTopListingsQuery({ range, ebayAccountId, sortBy, page, limit: TOP_LISTINGS_DEFAULT_LIMIT }, { skip: !ebayAccountId })`, owns the view mode (`useState<ViewMode>('grid')`), builds `sortOptions` (five keys, label `t('dashboard.topSellers.sort.<key>')`, value = the key), `columns` via `useTopSellersColumns`, and `renderGridCard(item)` = `<ListingCard {...toListingCardProps(item.listing, t, locale)} stats={toTopSellerStats(item, t, locale)} trend={<Sparkline values={item.series} tone={tone} ariaLabel={t('dashboard.topSellers.trendAria')} />} orientation="horizontal" onClick={() => onOpenListing(item.listing.id)} />` — tone from `changes.sales` (≥0 positive, <0 negative, null neutral). Loading = `isFetching && !currentData` (the dashboard's rule).
  - Component: `Card`-less (the Listings page renders `DataTable` on the canvas) — `DataTable` with `defaultViewMode`/`viewMode`, `gridMinItemWidth="27rem"`, `gridMaxColumns={2}`, `resultLabel={<Trans i18nKey="dashboard.topSellers.result" count={total} components={{ b: <Text as="span" weight="bold" /> }} />}` (follow the Listings page's exact Trans usage), `sortOptions`, `sortValue`, `onSortChange`, `sortLabel={t('dashboard.topSellers.sortLabel')}`, `pagination`, `loading`, `emptyContent` (`EmptyState` with `dashboard.topSellers.emptyTitle/emptySubtitle`), `onRowClick`.
  - `useTopSellersColumns`: product (`ProductTableCell` with title/image/ASIN/eBay ID meta, width 20.5rem), trend (`Sparkline size="sm"`, 8rem), sales (right, + change caption toned), units, orders, net profit (right, toned, estimated caption), price (`listing.price`), stock (`quantity / formatSourceStock(...)`). Mirror `useListingsColumns` styles for numeric cells.

- [ ] **Step 6: Wire the tab** — `DashboardTab.TOP_SELLERS` in the container's `tabs` (`label: t('dashboard.tabs.topSellers')`, icon `trending-up` — check the Icon registry; use the closest existing name), render `{activeTab === DashboardTab.TOP_SELLERS && <TopSellersPanel {...topSellersProps} />}`; `onOpenListing` → `localeNavigate('/listings/' + id)`. The date filter stays visible on this tab.

- [ ] **Step 7: Demo** — `buildDemoTopListings(input, sortBy, page, limit)` in `demoData.ts`: resolve the range with `resolveDashboardRange` (browser today, like `buildDemoDashboard`), group `DEMO_ORDERS` in R and in `periods[0].comparison` by `listingId` (tracked, non-cancelled), compute metrics/changes like the API, sort by the key with the same null-last rule, slice the page, attach the matching demo listing (`DEMO_LISTINGS` or whatever the fixture is named) and a series over `dashboardBucketKeys`. `demoBaseQuery.ts`: answer `/dashboard/top-listings` before `/dashboard` (path match order).

- [ ] **Step 8: i18n** — all 16 `dashboard.json`: `tabs.topSellers` ("Top sellers" / "En çok satanlar"); `topSellers.result_one/_other` ("<b>{{count}}</b> listing sold" / "<b>{{count}}</b> listings sold"; TR "<b>{{count}}</b> listing satıldı"), `topSellers.sortLabel`, `topSellers.sort.{sales,units,orders,netProfit,change}` (EN "Revenue", "Units", "Orders", "Net profit", "Change"; TR "Ciro", "Adet", "Sipariş", "Net kâr", "Değişim"), `topSellers.stats.{sales,units,orders,netProfit}` (same words), `topSellers.columns.{product,trend,sales,units,orders,netProfit,price,stock}` (TR "Ürün", "Trend", "Ciro", "Adet", "Sipariş", "Net kâr", "Fiyat", "Stok (eBay/AMZ)"), `topSellers.estimated` ("estimated" / "tahmini"), `topSellers.emptyTitle` ("Nothing sold in this period" / "Bu dönemde satış yok"), `topSellers.emptySubtitle`, `topSellers.trendAria` ("Trend over the selected period" / "Seçili dönemdeki gidiş"). Plural sets per CLAUDE.md; preserve line endings; parity check.

- [ ] **Step 9: Verify** — `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm --filter web test; pnpm typecheck; pnpm lint`. Manual in demo mode (`pnpm --filter web exec vite --port 5199`; demo via `sessionStorage.sellerhill_demo = '1'`): `/tr/dashboard?tab=topSellers` at 1440 and 375 px, cards and table, each sort, Today and This month, a page change; screenshots, look at them; stop the server.

- [ ] **Step 10: Commit** — `feat(dashboard): Top sellers tab — best sellers of the selected range in the listings card/table format`.

---

### Task 4: Docs and final verification

**Files:** `CLAUDE.md`, `docs/superpowers/specs/2026-10-08-dashboard-top-sellers-design.md`

- [ ] **Step 1: Spec correction** — §4 "Queries" item 3: the hydration lives in `TopListingsController` inside `ListingsModule`, which imports `DashboardModule` (not the reverse), so no module cycle.
- [ ] **Step 2: CLAUDE.md** — in "Dashboard panel": the fourth tab `?tab=topSellers`, URL `tsort`/`tpage`, endpoint `GET /v1/dashboard/top-listings` (where the code lives and why the controller is in `ListingsModule`), ranking rule (tracked, non-cancelled, same `periodSelect` and bounds as the cards, sorts, null-last change), hydration via `getListingsByIds` (drops deleted listings, total stays the SQL count), the `Sparkline` atom and the `ListingCard.trend` slot.
- [ ] **Step 3: Full verification** — `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm --filter api test; pnpm --filter web test; pnpm typecheck; pnpm lint`. Known unrelated: api `ebay-campaigns.guard.spec.ts`; web `campaigns.routes.test.tsx` flaky (passes alone).
- [ ] **Step 4: Commit** — `docs: dashboard top sellers tab`.
