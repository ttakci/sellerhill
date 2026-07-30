/**
 * Dashboard Service
 * Sellerboard-style metrics: today / this week / this month / this year
 * + chart (day|week|month buckets) + P&L matrix (12 months).
 *
 * Bucket keys are produced with `to_char(...)` (plain text) rather than a `date`
 * column: node-pg parses a `date` into a LOCAL-midnight Date, so building the key
 * with `toISOString()` silently shifted a day on any non-UTC server (e.g. UTC+3),
 * making every bucket miss and the chart render empty.
 */

import { Injectable } from '@nestjs/common';
import {
  DASHBOARD_CURRENT_PERIOD_KEY,
  DashboardChartGranularity,
  OrderCostCaptureStatus,
  OrderStatus,
  type DashboardChartPoint,
  type DashboardDataDto,
  type DashboardHistoryMonth,
  type DashboardMetricsDto,
  type PeriodMetricsDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

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

interface MetricsQueryRow {
  today: PeriodAggregateRow;
  yesterday: PeriodAggregateRow;
  this_week: PeriodAggregateRow;
  last_week_span: PeriodAggregateRow;
  this_month: PeriodAggregateRow;
  same_period_last_month: PeriodAggregateRow;
  this_year: PeriodAggregateRow;
  same_period_last_year: PeriodAggregateRow;
}

/** One grouped bucket (chart point or P&L month) — aggregates plus its bucket key. */
interface BucketQueryRow extends PeriodAggregateRow {
  period: string;
}

/** SQL fragments per chart granularity — enum-validated, never user text. */
const GRANULARITY_SQL: Record<
  DashboardChartGranularity,
  { trunc: string; since: string; buckets: number }
> = {
  [DashboardChartGranularity.DAY]: {
    trunc: "date_trunc('day', order_date)",
    since: "CURRENT_DATE - INTERVAL '29 days'",
    buckets: 30,
  },
  [DashboardChartGranularity.WEEK]: {
    trunc: "date_trunc('week', order_date)",
    since: "date_trunc('week', CURRENT_DATE) - INTERVAL '11 weeks'",
    buckets: 12,
  },
  [DashboardChartGranularity.MONTH]: {
    trunc: "date_trunc('month', order_date)",
    since: "date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'",
    buckets: 12,
  },
};

const HISTORY_MONTHS = 12;

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard(
    userId: string,
    granularity: DashboardChartGranularity,
    ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    // Buckets are zero-filled in JS but keyed by Postgres' calendar, so the anchor
    // must come from the DB: an API process in UTC+3 talking to a UTC database
    // would otherwise generate keys that never match and render an empty chart.
    const anchor = await this.getAnchorDate();

    const [metrics, chart, history] = await Promise.all([
      this.getMetrics(userId, ebayAccountId),
      this.getChart(userId, granularity, anchor, ebayAccountId),
      this.getHistory(userId, anchor, ebayAccountId),
    ]);

    return { metrics, chart, history };
  }

  /** Postgres' `CURRENT_DATE` as a local Date — the calendar all buckets align to. */
  private async getAnchorDate(): Promise<Date> {
    const rows = await this.databaseService.query<{ today: string }>(
      `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today`,
    );
    const raw = rows[0]?.today;
    if (!raw) {
      return new Date();
    }
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
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

  /** Local (server-timezone) YYYY-MM-DD — must match `to_char` output from Postgres. */
  private toIsoDate(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Monday of the week containing `d` (matches Postgres ISO `date_trunc('week')`). */
  private startOfIsoWeek(d: Date): Date {
    const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = copy.getDay(); // 0 Sun … 6 Sat
    copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
    return copy;
  }

  /** Oldest → newest bucket keys for the requested granularity, anchored on the DB date. */
  private bucketKeys(granularity: DashboardChartGranularity, anchor: Date): string[] {
    const { buckets } = GRANULARITY_SQL[granularity];
    const keys: string[] = [];

    for (let i = buckets - 1; i >= 0; i--) {
      if (granularity === DashboardChartGranularity.DAY) {
        const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - i);
        keys.push(this.toIsoDate(d));
        continue;
      }
      if (granularity === DashboardChartGranularity.WEEK) {
        const monday = this.startOfIsoWeek(anchor);
        monday.setDate(monday.getDate() - i * 7);
        keys.push(this.toIsoDate(monday));
        continue;
      }
      keys.push(this.toIsoDate(new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)));
    }

    return keys;
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

  private sumAggregates(rows: PeriodAggregateRow[]): PeriodAggregateRow {
    const acc = this.emptyAggregate();
    const keys = Object.keys(acc) as (keyof PeriodAggregateRow)[];
    for (const row of rows) {
      for (const key of keys) {
        acc[key] = this.num(acc[key]) + this.num(row[key]);
      }
    }
    return acc;
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
   * Splits profit/revenue into confidence tiers by `cost_capture_status`:
   *   - confirmed   = linked (trusted Amazon costs scraped)
   *   - provisional = product-only costs (purchase price known, tax/shipping pending)
   *   - uncosted    = pending/failed/untracked (revenue only, no reliable cost basis)
   */
  private periodSelect(): string {
    const c = OrderStatus.CANCELLED;
    const linked = OrderCostCaptureStatus.LINKED;
    const provisional = OrderCostCaptureStatus.PROVISIONAL;
    const pending = OrderCostCaptureStatus.PENDING;
    const failed = OrderCostCaptureStatus.FAILED;
    const untracked = OrderCostCaptureStatus.UNTRACKED;
    const live = `WHERE status <> '${c}'`;
    return `
      COALESCE(SUM(sale_total) FILTER (${live}), 0) AS sales,
      COUNT(*) FILTER (${live}) AS orders,
      COALESCE(SUM(quantity) FILTER (${live}), 0) AS units,
      COUNT(*) FILTER (WHERE status = '${c}') AS refunds,
      COALESCE(SUM(COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0))
        FILTER (${live}), 0) AS gross_profit,
      COALESCE(SUM(COALESCE(ebay_earnings, 0)) FILTER (${live}), 0) AS payout,
      COALESCE(SUM(net_profit) FILTER (${live} AND cost_capture_status = '${linked}'), 0) AS profit_confirmed,
      COALESCE(SUM(net_profit) FILTER (${live} AND cost_capture_status = '${provisional}'), 0) AS profit_provisional,
      COALESCE(SUM(sale_total) FILTER (${live} AND cost_capture_status IN ('${pending}','${failed}','${untracked}')), 0) AS revenue_uncosted,
      COUNT(*) FILTER (${live} AND cost_capture_status = '${pending}') AS orders_pending_capture,
      COUNT(*) FILTER (${live} AND cost_capture_status = '${failed}') AS orders_capture_failed,
      COUNT(*) FILTER (${live} AND cost_capture_status = '${untracked}') AS orders_untracked,
      COALESCE(SUM(COALESCE(purchase_price, 0)) FILTER (${live}), 0) AS cost_of_goods,
      COALESCE(SUM(COALESCE(transaction_fee, 0)) FILTER (${live}), 0) AS transaction_fees,
      COALESCE(SUM(COALESCE(ad_fee, 0)) FILTER (${live}), 0) AS ad_fees,
      COALESCE(SUM(COALESCE(amazon_shipping, 0)) FILTER (${live}), 0) AS amazon_shipping,
      COALESCE(SUM(COALESCE(amazon_tax, 0)) FILTER (${live}), 0) AS amazon_tax
    `;
  }

  private storeClause(ebayAccountId: string | undefined, paramIndex: number): string {
    return ebayAccountId ? ` AND ebay_account_id = $${paramIndex}` : '';
  }

  /* ─── period cards ─── */

  private async getMetrics(userId: string, ebayAccountId?: string): Promise<DashboardMetricsDto> {
    const s = this.storeClause(ebayAccountId, 2);
    const params: string[] = ebayAccountId ? [userId, ebayAccountId] : [userId];
    const sel = this.periodSelect();

    // Postgres date_trunc('week') is Monday-start (ISO).
    const result = await this.databaseService.query<MetricsQueryRow>(
      `WITH bounds AS (
        SELECT
          CURRENT_DATE AS today,
          CURRENT_DATE - INTERVAL '1 day' AS yesterday,
          date_trunc('week', CURRENT_DATE)::date AS week_start,
          (date_trunc('week', CURRENT_DATE) - INTERVAL '1 week')::date AS last_week_start,
          date_trunc('month', CURRENT_DATE)::date AS month_start,
          (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS last_month_start,
          date_trunc('year', CURRENT_DATE)::date AS year_start,
          (date_trunc('year', CURRENT_DATE) - INTERVAL '1 year')::date AS last_year_start,
          EXTRACT(DAY FROM CURRENT_DATE)::int AS day_of_month,
          (CURRENT_DATE - date_trunc('week', CURRENT_DATE)::date)::int AS days_into_week,
          (CURRENT_DATE - date_trunc('year', CURRENT_DATE)::date)::int AS days_into_year
      ),
      today AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.today AND order_date < b.today + INTERVAL '1 day'
      ),
      yesterday AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.yesterday AND order_date < b.today
      ),
      this_week AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.week_start
      ),
      last_week_span AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.last_week_start
          AND order_date < b.last_week_start + (b.days_into_week + 1) * INTERVAL '1 day'
      ),
      this_month AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.month_start
      ),
      same_period_last_month AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.last_month_start
          AND order_date < b.last_month_start + b.day_of_month * INTERVAL '1 day'
      ),
      this_year AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.year_start
      ),
      same_period_last_year AS (
        SELECT ${sel}
        FROM orders, bounds b
        WHERE user_id = $1 ${s}
          AND order_date >= b.last_year_start
          AND order_date < b.last_year_start + (b.days_into_year + 1) * INTERVAL '1 day'
      )
      SELECT
        to_jsonb(t) AS today,
        to_jsonb(y) AS yesterday,
        to_jsonb(w) AS this_week,
        to_jsonb(lw) AS last_week_span,
        to_jsonb(m) AS this_month,
        to_jsonb(sm) AS same_period_last_month,
        to_jsonb(ytd) AS this_year,
        to_jsonb(ly) AS same_period_last_year
      FROM today t, yesterday y, this_week w, last_week_span lw,
           this_month m, same_period_last_month sm, this_year ytd, same_period_last_year ly`,
      params,
    );

    const r = result[0];
    if (!r) {
      const empty = this.buildPeriod(this.emptyAggregate());
      return { today: empty, thisWeek: empty, thisMonth: empty, thisYear: empty };
    }

    return {
      today: this.buildPeriod(r.today, r.yesterday),
      thisWeek: this.buildPeriod(r.this_week, r.last_week_span),
      thisMonth: this.buildPeriod(r.this_month, r.same_period_last_month),
      thisYear: this.buildPeriod(r.this_year, r.same_period_last_year),
    };
  }

  /* ─── chart tab ─── */

  private async getChart(
    userId: string,
    granularity: DashboardChartGranularity,
    anchor: Date,
    ebayAccountId?: string,
  ): Promise<{
    granularity: DashboardChartGranularity;
    points: DashboardChartPoint[];
    summary: PeriodMetricsDto;
  }> {
    const s = this.storeClause(ebayAccountId, 2);
    const params: string[] = ebayAccountId ? [userId, ebayAccountId] : [userId];
    const { trunc, since } = GRANULARITY_SQL[granularity];

    const rows = await this.databaseService.query<BucketQueryRow>(
      `SELECT
         to_char(${trunc}, 'YYYY-MM-DD') AS period,
         ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1
         AND order_date >= ${since}
         ${s}
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );

    const byBucket = new Map<string, PeriodAggregateRow>();
    for (const row of rows) {
      byBucket.set(row.period, row);
    }

    const points: DashboardChartPoint[] = [];
    const filled: PeriodAggregateRow[] = [];

    for (const key of this.bucketKeys(granularity, anchor)) {
      const agg = byBucket.get(key) ?? this.emptyAggregate();
      filled.push(agg);
      points.push({
        period: key,
        sales: this.round(this.num(agg.sales)),
        units: this.num(agg.units),
        orders: this.num(agg.orders),
        netProfit: this.round(this.num(agg.profit_confirmed)),
        grossProfit: this.round(this.num(agg.gross_profit)),
        refunds: this.num(agg.refunds),
      });
    }

    return {
      granularity,
      points,
      summary: this.buildPeriod(this.sumAggregates(filled)),
    };
  }

  /* ─── P&L tab ─── */

  private async getHistory(
    userId: string,
    anchor: Date,
    ebayAccountId?: string,
  ): Promise<{ months: DashboardHistoryMonth[] }> {
    const s = this.storeClause(ebayAccountId, 2);
    const params: string[] = ebayAccountId ? [userId, ebayAccountId] : [userId];

    const rows = await this.databaseService.query<BucketQueryRow>(
      `SELECT
         to_char(date_trunc('month', order_date), 'YYYY-MM-DD') AS period,
         ${this.periodSelect()}
       FROM orders
       WHERE user_id = $1
         AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '${HISTORY_MONTHS - 1} months'
         ${s}
       GROUP BY 1
       ORDER BY 1 DESC`,
      params,
    );

    const byMonth = new Map<string, PeriodAggregateRow>();
    for (const row of rows) {
      byMonth.set(row.period, row);
    }

    // Newest first (current month first), missing months filled with zeros.
    const months: DashboardHistoryMonth[] = [];

    for (let i = 0; i < HISTORY_MONTHS; i++) {
      const start = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      const dateFrom = this.toIsoDate(start);
      const dateTo = this.toIsoDate(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      const agg = byMonth.get(dateFrom) ?? this.emptyAggregate();
      const period = this.buildPeriod(agg);

      months.push({
        key: i === 0 ? DASHBOARD_CURRENT_PERIOD_KEY : dateFrom.slice(0, 7),
        dateFrom,
        dateTo,
        sales: period.sales,
        units: period.units,
        orders: period.orders,
        refunds: period.refunds,
        adFee: period.adFees,
        amazonShipping: period.amazonShipping,
        amazonTax: period.amazonTax,
        purchasePrice: period.costOfGoods,
        transactionFee: period.transactionFees,
        ebayEarnings: period.estimatedPayout,
        grossProfit: period.grossProfit,
        netProfit: period.netProfit,
        profitConfirmed: period.profitConfirmed,
        profitProvisional: period.profitProvisional,
        estimatedPayout: period.estimatedPayout,
        margin: period.margin,
        roi: period.roi,
      });
    }

    return { months };
  }
}
