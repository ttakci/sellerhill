/**
 * Dashboard Service
 * Range-driven metrics: four period cards (each with a comparison window), a chart
 * and a P&L matrix, all over ONE seller-chosen date range.
 *
 * THE SELLER'S CALENDAR, NEVER THE DATABASE'S. "Today" comes from the seller's own
 * time zone (`now() AT TIME ZONE $tz`), windows are local-midnight bounds
 * (`buildLocalRangeSql`) and buckets are cut in that zone. The database's own calendar date is
 * UTC on production, which put a late-evening Istanbul sale on the wrong day.
 *
 * Bucket keys are produced with `to_char(...)` (plain text) rather than a `date`
 * column: node-pg parses a `date` into a LOCAL-midnight Date, so building the key
 * with `toISOString()` silently shifted a day on any non-UTC server.
 */

import { Injectable } from '@nestjs/common';
import {
  DashboardChartGranularity,
  DashboardRangeError,
  OrderCostCaptureStatus,
  OrderStatus,
  dashboardBucketKeys,
  dashboardBucketWindows,
  isIsoDate,
  resolveDashboardRange,
  type DashboardChartPoint,
  type DashboardDataDto,
  type DashboardDateWindow,
  type DashboardPnlColumn,
  type DashboardRangeInput,
  type DashboardStoreMetrics,
  type PeriodMetricsDto,
} from '@repo/shared';

import { DatabaseService, type QueryParam } from '../../common/database/database.service';
import { buildLocalRangeSql } from '../../common/timezone/local-day-sql';
import { TimezoneService } from '../../common/timezone/timezone.service';

/**
 * Raw aggregate shape produced by `periodSelect()`.
 * `numeric`/`bigint` columns arrive as strings from node-pg; `to_jsonb` variants
 * arrive as JSON numbers — both are normalized through `num()`.
 */
interface PeriodAggregateRow {
  sales: string | number;
  orders: string | number;
  units: string | number;
  refunds: string | number;
  gross_profit: string | number;
  payout: string | number;
  profit_confirmed: string | number;
  profit_provisional: string | number;
  revenue_uncosted: string | number;
  orders_pending_capture: string | number;
  orders_capture_failed: string | number;
  orders_untracked: string | number;
  cost_of_goods: string | number;
  transaction_fees: string | number;
  ad_fees: string | number;
  amazon_shipping: string | number;
  amazon_tax: string | number;
}

interface WindowAggregateRow extends PeriodAggregateRow {
  idx: string | number;
}

/** One grouped bucket (chart point or P&L column) — aggregates plus its bucket key. */
interface BucketQueryRow extends PeriodAggregateRow {
  period: string;
}

interface StoreAggregateRow extends PeriodAggregateRow {
  ebay_account_id: string | null;
  is_total: number | string;
}

/** date_trunc unit + to_char format per granularity — enum-keyed, never user text. */
const BUCKET_SQL: Record<DashboardChartGranularity, { unit: string; format: string }> = {
  [DashboardChartGranularity.HOUR]: { unit: 'hour', format: 'YYYY-MM-DD HH24' },
  [DashboardChartGranularity.DAY]: { unit: 'day', format: 'YYYY-MM-DD' },
  [DashboardChartGranularity.WEEK]: { unit: 'week', format: 'YYYY-MM-DD' },
  [DashboardChartGranularity.MONTH]: { unit: 'month', format: 'YYYY-MM-DD' },
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timezoneService: TimezoneService,
  ) {}

  async getDashboard(
    userId: string,
    input: DashboardRangeInput,
    ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    const timezone = await this.timezoneService.getForUser(userId);
    const today = await this.getLocalToday(timezone);
    const resolved = resolveDashboardRange(input, today); // DashboardRangeError → 400 in the controller
    const windows = resolved.periods.flatMap((p) => [{ from: p.from, to: p.to }, p.comparison]);
    const samePnlBuckets = resolved.pnlGranularity === resolved.chartGranularity;

    const [aggregates, chartRows, pnlRows] = await Promise.all([
      this.aggregateWindows(userId, windows, timezone, ebayAccountId),
      this.aggregateBuckets(userId, resolved.range, resolved.chartGranularity, timezone, ebayAccountId),
      samePnlBuckets
        ? Promise.resolve(null)
        : this.aggregateBuckets(userId, resolved.range, resolved.pnlGranularity, timezone, ebayAccountId),
    ]);

    const periods = resolved.periods.map((p, k) => ({
      from: p.from,
      to: p.to,
      label: p.label,
      metrics: this.buildPeriod(aggregates[2 * k], aggregates[2 * k + 1]),
    }));

    const points: DashboardChartPoint[] = dashboardBucketKeys(
      resolved.range,
      resolved.chartGranularity,
    ).map((key) => {
      const agg = chartRows.get(key) ?? this.emptyAggregate();
      return {
        period: key,
        sales: this.round(this.num(agg.sales)),
        units: this.num(agg.units),
        orders: this.num(agg.orders),
        netProfit: this.round(this.num(agg.profit_confirmed)),
        grossProfit: this.round(this.num(agg.gross_profit)),
        refunds: this.num(agg.refunds),
      };
    });

    const pnlSource = pnlRows ?? chartRows;
    const columns: DashboardPnlColumn[] = dashboardBucketWindows(
      resolved.range,
      resolved.pnlGranularity,
    )
      .reverse()
      .map((w) => this.toPnlColumn(w.key, w, pnlSource.get(w.key) ?? this.emptyAggregate(), today));

    return {
      range: {
        preset: resolved.preset,
        from: resolved.range.from,
        to: resolved.range.to,
        today,
        timezone,
        chartGranularity: resolved.chartGranularity,
        pnlGranularity: resolved.pnlGranularity,
      },
      periods,
      chart: { granularity: resolved.chartGranularity, points, summary: periods[0].metrics },
      pnl: { granularity: resolved.pnlGranularity, columns },
    };
  }

  /* ─── the e-mail contract: same fragment, same numbers as the cards ─── */

  async getRangeMetrics(
    userId: string,
    window: DashboardDateWindow,
    timezone: string,
    ebayAccountId?: string,
  ): Promise<PeriodMetricsDto> {
    this.assertWindow(window);
    const [row] = await this.aggregateWindows(userId, [window], timezone, ebayAccountId);
    return this.buildPeriod(row);
  }

  async getDayMetrics(
    userId: string,
    localDate: string,
    timezone: string,
    ebayAccountId?: string,
  ): Promise<PeriodMetricsDto> {
    return this.getRangeMetrics(userId, { from: localDate, to: localDate }, timezone, ebayAccountId);
  }

  async getRangeMetricsByStore(
    userId: string,
    window: DashboardDateWindow,
    timezone: string,
  ): Promise<{ total: PeriodMetricsDto; stores: DashboardStoreMetrics[] }> {
    this.assertWindow(window);
    const rows = await this.databaseService.query<StoreAggregateRow>(
      `SELECT ebay_account_id, GROUPING(ebay_account_id) AS is_total, ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1 AND ${buildLocalRangeSql('order_date', '$2', '$3', '$4')}
       GROUP BY GROUPING SETS ((ebay_account_id), ())`,
      [userId, window.from, window.to, timezone],
    );
    const totalRow = rows.find((r) => this.num(r.is_total) === 1) ?? this.emptyAggregate();
    const stores = rows
      .filter((r) => this.num(r.is_total) === 0 && r.ebay_account_id)
      .map((r) => ({ ebayAccountId: r.ebay_account_id as string, metrics: this.buildPeriod(r) }));
    return { total: this.buildPeriod(totalRow), stores };
  }

  /* ─── queries ─── */

  private assertWindow(window: DashboardDateWindow): void {
    if (!isIsoDate(window.from) || !isIsoDate(window.to) || window.from > window.to) {
      throw new DashboardRangeError(`invalid window ${window.from}..${window.to}`);
    }
  }

  /** The seller's calendar today — never the database's calendar date (UTC on production). */
  private async getLocalToday(timezone: string): Promise<string> {
    const rows = await this.databaseService.query<{ today: string }>(
      `SELECT to_char((now() AT TIME ZONE $1::text)::date, 'YYYY-MM-DD') AS today`,
      [timezone],
    );
    return rows[0].today;
  }

  /** One aggregate per window, index-aligned with the input, in ONE statement. */
  private async aggregateWindows(
    userId: string,
    windows: DashboardDateWindow[],
    timezone: string,
    ebayAccountId?: string,
  ): Promise<PeriodAggregateRow[]> {
    const params: QueryParam[] = [userId, windows.map((w) => w.from), windows.map((w) => w.to), timezone];
    const store = ebayAccountId ? ' AND orders.ebay_account_id = $5' : '';
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const rows = await this.databaseService.query<WindowAggregateRow>(
      `SELECT w.idx, ${this.periodSelect()}
       FROM unnest($2::date[], $3::date[]) WITH ORDINALITY AS w(d_from, d_to, idx)
       LEFT JOIN orders
         ON orders.user_id = $1
        AND ${buildLocalRangeSql('orders.order_date', 'w.d_from', 'w.d_to', '$4')}${store}
       GROUP BY w.idx
       ORDER BY w.idx`,
      params,
    );
    const byIdx = new Map(rows.map((r) => [this.num(r.idx), r]));
    return windows.map((_, i) => byIdx.get(i + 1) ?? this.emptyAggregate());
  }

  private async aggregateBuckets(
    userId: string,
    range: DashboardDateWindow,
    granularity: DashboardChartGranularity,
    timezone: string,
    ebayAccountId?: string,
  ): Promise<Map<string, PeriodAggregateRow>> {
    const { unit, format } = BUCKET_SQL[granularity];
    const params: QueryParam[] = [userId, range.from, range.to, timezone];
    const store = ebayAccountId ? ' AND ebay_account_id = $5' : '';
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const rows = await this.databaseService.query<BucketQueryRow>(
      `SELECT to_char(date_trunc('${unit}', order_date AT TIME ZONE $4::text), '${format}') AS period,
              ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1 AND ${buildLocalRangeSql('order_date', '$2', '$3', '$4')}${store}
       GROUP BY 1`,
      params,
    );
    return new Map(rows.map((r) => [r.period, r]));
  }

  private toPnlColumn(
    key: string,
    w: DashboardDateWindow,
    agg: PeriodAggregateRow,
    today: string,
  ): DashboardPnlColumn {
    const p = this.buildPeriod(agg);
    return {
      key,
      dateFrom: w.from,
      dateTo: w.to,
      isCurrent: w.from <= today && today <= w.to,
      sales: p.sales,
      units: p.units,
      orders: p.orders,
      refunds: p.refunds,
      adFee: p.adFees,
      amazonShipping: p.amazonShipping,
      amazonTax: p.amazonTax,
      purchasePrice: p.costOfGoods,
      transactionFee: p.transactionFees,
      ebayEarnings: p.estimatedPayout,
      grossProfit: p.grossProfit,
      netProfit: p.netProfit,
      profitConfirmed: p.profitConfirmed,
      profitProvisional: p.profitProvisional,
      estimatedPayout: p.estimatedPayout,
      margin: p.margin,
      roi: p.roi,
    };
  }

  /* ─── shared helpers ─── */

  private num(value: unknown): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
    return Number.isFinite(n) ? n : 0;
  }

  private round(value: number, decimals = 2): number {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
  }

  private calcChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return null;
    }
    return this.round(((current - previous) / previous) * 100, 1);
  }

  private emptyAggregate(): PeriodAggregateRow {
    return {
      sales: 0,
      orders: 0,
      units: 0,
      refunds: 0,
      gross_profit: 0,
      payout: 0,
      profit_confirmed: 0,
      profit_provisional: 0,
      revenue_uncosted: 0,
      orders_pending_capture: 0,
      orders_capture_failed: 0,
      orders_untracked: 0,
      cost_of_goods: 0,
      transaction_fees: 0,
      ad_fees: 0,
      amazon_shipping: 0,
      amazon_tax: 0,
    };
  }

  /**
   * Headline `netProfit` = confirmed (linked) profit only — an unknown Amazon cost
   * is never presented as a real zero. Provisional/uncosted tiers ride alongside.
   */
  private buildPeriod(row: PeriodAggregateRow, previous?: PeriodAggregateRow): PeriodMetricsDto {
    const sales = this.num(row.sales);
    const orders = this.num(row.orders);
    const refunds = this.num(row.refunds);
    const profit = this.num(row.profit_confirmed);
    const costOfGoods = this.num(row.cost_of_goods);

    return {
      sales: this.round(sales),
      orders,
      units: this.num(row.units),
      refunds,
      grossProfit: this.round(this.num(row.gross_profit)),
      netProfit: this.round(profit),
      estimatedPayout: this.round(this.num(row.payout)),
      margin: sales > 0 ? this.round((profit / sales) * 100, 1) : 0,
      avgOrderValue: orders > 0 ? this.round(sales / orders) : 0,
      trend: previous ? this.calcChange(sales, this.num(previous.sales)) : null,
      profitTrend: previous ? this.calcChange(profit, this.num(previous.profit_confirmed)) : null,
      profitConfirmed: this.round(profit),
      profitProvisional: this.round(this.num(row.profit_provisional)),
      revenueUncosted: this.round(this.num(row.revenue_uncosted)),
      ordersPendingCapture: this.num(row.orders_pending_capture),
      ordersCaptureFailed: this.num(row.orders_capture_failed),
      ordersUntracked: this.num(row.orders_untracked),
      costOfGoods: this.round(costOfGoods),
      transactionFees: this.round(this.num(row.transaction_fees)),
      adFees: this.round(this.num(row.ad_fees)),
      amazonShipping: this.round(this.num(row.amazon_shipping)),
      amazonTax: this.round(this.num(row.amazon_tax)),
      roi: costOfGoods > 0 ? this.round((profit / costOfGoods) * 100, 1) : 0,
      refundRate: orders + refunds > 0 ? this.round((refunds / (orders + refunds)) * 100, 1) : 0,
    };
  }

  /**
   * Shared SELECT fragment for period aggregates.
   *
   * THE DASHBOARD DESCRIBES THE BUSINESS SELLERHILL MANAGES, NOT THE WHOLE
   * eBAY STORE. Every figure is scoped to TRACKED orders — rows whose eBay item
   * matched a SellerHill listing at ingest (`listing_id IS NOT NULL`, the same
   * predicate `OrdersService` uses for its `tracked` filter and `recomputeProfit`
   * inverts to set `cost_capture_status = 'untracked'`). An untracked order has
   * no product cost and never can (eBay's payload carries no ASIN), so letting
   * it into the totals inflated Sales/Payout while contributing nothing to
   * profit, and — worse — counted its whole payout as gross profit and ROI
   * because its `purchase_price` is 0. Those orders stay visible on the Orders
   * page ("Not tracked") and in the Action Center's untracked-sales item; the
   * one figure they contribute here is `orders_untracked`, the count the card
   * shows as "excluded", so a seller comparing the two screens is never left
   * wondering where their orders went.
   *
   * Splits profit/revenue into confidence tiers by `cost_capture_status`:
   *   - confirmed   = linked (trusted Amazon costs scraped)
   *   - provisional = product-only costs (purchase price known, tax/shipping pending)
   *   - uncosted    = pending/failed (revenue only, no reliable cost basis yet)
   */
  private periodSelect(): string {
    const c = OrderStatus.CANCELLED;
    const linked = OrderCostCaptureStatus.LINKED;
    const provisional = OrderCostCaptureStatus.PROVISIONAL;
    const pending = OrderCostCaptureStatus.PENDING;
    const failed = OrderCostCaptureStatus.FAILED;
    const tracked = 'listing_id IS NOT NULL';
    const live = `WHERE status <> '${c}' AND ${tracked}`;
    return `
      COALESCE(SUM(sale_total) FILTER (${live}), 0) AS sales,
      COUNT(*) FILTER (${live}) AS orders,
      COALESCE(SUM(quantity) FILTER (${live}), 0) AS units,
      COUNT(*) FILTER (WHERE status = '${c}' AND ${tracked}) AS refunds,
      COALESCE(SUM(COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0))
        FILTER (${live}), 0) AS gross_profit,
      COALESCE(SUM(COALESCE(ebay_earnings, 0)) FILTER (${live}), 0) AS payout,
      COALESCE(SUM(net_profit) FILTER (${live} AND cost_capture_status = '${linked}'), 0) AS profit_confirmed,
      COALESCE(SUM(net_profit) FILTER (${live} AND cost_capture_status = '${provisional}'), 0) AS profit_provisional,
      COALESCE(SUM(sale_total) FILTER (${live} AND cost_capture_status IN ('${pending}','${failed}')), 0) AS revenue_uncosted,
      COUNT(*) FILTER (${live} AND cost_capture_status = '${pending}') AS orders_pending_capture,
      COUNT(*) FILTER (${live} AND cost_capture_status = '${failed}') AS orders_capture_failed,
      COUNT(*) FILTER (WHERE status <> '${c}' AND listing_id IS NULL) AS orders_untracked,
      COALESCE(SUM(COALESCE(purchase_price, 0)) FILTER (${live}), 0) AS cost_of_goods,
      COALESCE(SUM(COALESCE(transaction_fee, 0)) FILTER (${live}), 0) AS transaction_fees,
      COALESCE(SUM(COALESCE(ad_fee, 0)) FILTER (${live}), 0) AS ad_fees,
      COALESCE(SUM(COALESCE(amazon_shipping, 0)) FILTER (${live}), 0) AS amazon_shipping,
      COALESCE(SUM(COALESCE(amazon_tax, 0)) FILTER (${live}), 0) AS amazon_tax
    `;
  }
}
