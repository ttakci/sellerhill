/**
 * Dashboard Service
 * Sellerboard-style metrics: today, this week, this month, last month
 * + chart (monthly) + history (P&L matrix)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  OrderCostCaptureStatus,
  OrderStatus,
  type DashboardChartPoint,
  type DashboardDataDto,
  type DashboardHistoryMonth,
  type DashboardMetricsDto,
  type OrderDto,
  type PeriodMetricsDto,
  type RevenueTrendPoint,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard(
    userId: string,
    days?: number,
    ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    const safeDays = Math.max(7, Math.min(90, days || 14));
    const [metrics, revenueTrend, chart, history, recentOrders] = await Promise.all([
      this.getMetrics(userId, ebayAccountId),
      this.getRevenueTrend(userId, safeDays, ebayAccountId),
      this.getChart(userId, ebayAccountId),
      this.getHistory(userId, ebayAccountId),
      this.getRecentOrders(userId, ebayAccountId),
    ]);

    return { metrics, revenueTrend, chart, history, recentOrders };
  }

  private calcChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private buildPeriod(p: {
    sales: number;
    orders: number;
    units: number;
    refunds: number;
    grossProfit: number;
    payout: number;
    profitConfirmed: number;
    profitProvisional: number;
    revenueUncosted: number;
    ordersPendingCapture: number;
    ordersCaptureFailed: number;
    ordersUntracked: number;
    prevSales: number;
    prevProfitConfirmed: number;
  }): PeriodMetricsDto {
    const profit = p.profitConfirmed;
    return {
      sales: p.sales,
      orders: p.orders,
      units: p.units,
      refunds: p.refunds,
      grossProfit: p.grossProfit,
      netProfit: profit,
      estimatedPayout: p.payout,
      margin: p.sales > 0 ? Math.round((profit / p.sales) * 1000) / 10 : 0,
      avgOrderValue: p.orders > 0 ? Math.round((p.sales / p.orders) * 100) / 100 : 0,
      trend: this.calcChange(p.sales, p.prevSales),
      profitTrend: this.calcChange(profit, p.prevProfitConfirmed),
      profitConfirmed: p.profitConfirmed,
      profitProvisional: p.profitProvisional,
      revenueUncosted: p.revenueUncosted,
      ordersPendingCapture: p.ordersPendingCapture,
      ordersCaptureFailed: p.ordersCaptureFailed,
      ordersUntracked: p.ordersUntracked,
    };
  }

  private emptyPeriod(): PeriodMetricsDto {
    return this.buildPeriod({
      sales: 0,
      orders: 0,
      units: 0,
      refunds: 0,
      grossProfit: 0,
      payout: 0,
      profitConfirmed: 0,
      profitProvisional: 0,
      revenueUncosted: 0,
      ordersPendingCapture: 0,
      ordersCaptureFailed: 0,
      ordersUntracked: 0,
      prevSales: 0,
      prevProfitConfirmed: 0,
    });
  }

  /**
   * Shared SELECT fragment for period aggregates.
   * Splits profit/revenue into confidence tiers by `cost_capture_status`:
   *   - confirmed   = linked (trusted Amazon costs scraped)
   *   - provisional = product-only costs (purchase price known, tax/shipping pending)
   *   - uncosted    = pending/failed/untracked (revenue only, no reliable cost basis)
   * Headline `netProfit` (mapped from profit_confirmed) shows trusted-only profit.
   */
  private periodSelect(): string {
    const c = OrderStatus.CANCELLED;
    const linked = OrderCostCaptureStatus.LINKED;
    const provisional = OrderCostCaptureStatus.PROVISIONAL;
    const pending = OrderCostCaptureStatus.PENDING;
    const failed = OrderCostCaptureStatus.FAILED;
    const untracked = OrderCostCaptureStatus.UNTRACKED;
    return `
      COALESCE(SUM(sale_total) FILTER (WHERE status <> '${c}'), 0) AS sales,
      COUNT(*) FILTER (WHERE status <> '${c}') AS orders,
      COALESCE(SUM(quantity) FILTER (WHERE status <> '${c}'), 0) AS units,
      COUNT(*) FILTER (WHERE status = '${c}') AS refunds,
      COALESCE(SUM(COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0))
        FILTER (WHERE status <> '${c}'), 0) AS gross_profit,
      COALESCE(SUM(COALESCE(ebay_earnings, 0)) FILTER (WHERE status <> '${c}'), 0) AS payout,
      COALESCE(SUM(net_profit) FILTER (WHERE status <> '${c}' AND cost_capture_status = '${linked}'), 0) AS profit_confirmed,
      COALESCE(SUM(net_profit) FILTER (WHERE status <> '${c}' AND cost_capture_status = '${provisional}'), 0) AS profit_provisional,
      COALESCE(SUM(sale_total) FILTER (WHERE status <> '${c}' AND cost_capture_status IN ('${pending}','${failed}','${untracked}')), 0) AS revenue_uncosted,
      COUNT(*) FILTER (WHERE status <> '${c}' AND cost_capture_status = '${pending}') AS orders_pending_capture,
      COUNT(*) FILTER (WHERE status <> '${c}' AND cost_capture_status = '${failed}') AS orders_capture_failed,
      COUNT(*) FILTER (WHERE status <> '${c}' AND cost_capture_status = '${untracked}') AS orders_untracked
    `;
  }

  private storeClause(ebayAccountId: string | undefined, paramIndex: number): { sql: string; next: number } {
    if (!ebayAccountId) {
      return { sql: '', next: paramIndex };
    }
    return { sql: ` AND ebay_account_id = $${paramIndex}`, next: paramIndex + 1 };
  }

  private async getMetrics(userId: string, ebayAccountId?: string): Promise<DashboardMetricsDto> {
    const store = this.storeClause(ebayAccountId, 2);
    const params: string[] = [userId];
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const s = store.sql;
    const sel = this.periodSelect();

    // Postgres date_trunc('week') is Monday-start (ISO).
    const result = await this.databaseService.query<{
      // today
      t_sales: string; t_orders: string; t_units: string;
      t_refunds: string; t_gross: string; t_payout: string;
      t_profit_confirmed: string; t_profit_provisional: string; t_revenue_uncosted: string;
      t_orders_pending_capture: string; t_orders_capture_failed: string; t_orders_untracked: string;
      // yesterday (trend — confirmed profit only)
      y_sales: string; y_profit_confirmed: string;
      // this week
      w_sales: string; w_orders: string; w_units: string;
      w_refunds: string; w_gross: string; w_payout: string;
      w_profit_confirmed: string; w_profit_provisional: string; w_revenue_uncosted: string;
      w_orders_pending_capture: string; w_orders_capture_failed: string; w_orders_untracked: string;
      // last week same span (trend for this week)
      lw_sales: string; lw_profit_confirmed: string;
      // this month
      m_sales: string; m_orders: string; m_units: string;
      m_refunds: string; m_gross: string; m_payout: string;
      m_profit_confirmed: string; m_profit_provisional: string; m_revenue_uncosted: string;
      m_orders_pending_capture: string; m_orders_capture_failed: string; m_orders_untracked: string;
      // same period last month (trend)
      sm_sales: string; sm_profit_confirmed: string;
      // this year
      ytd_sales: string; ytd_orders: string; ytd_units: string;
      ytd_refunds: string; ytd_gross: string; ytd_payout: string;
      ytd_profit_confirmed: string; ytd_profit_provisional: string; ytd_revenue_uncosted: string;
      ytd_orders_pending_capture: string; ytd_orders_capture_failed: string; ytd_orders_untracked: string;
      // same YTD span last year (trend)
      ly_sales: string; ly_profit_confirmed: string;
    }>(
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
        t.sales as t_sales, t.orders as t_orders, t.units as t_units,
        t.refunds as t_refunds, t.gross_profit as t_gross, t.payout as t_payout,
        t.profit_confirmed as t_profit_confirmed, t.profit_provisional as t_profit_provisional,
        t.revenue_uncosted as t_revenue_uncosted,
        t.orders_pending_capture as t_orders_pending_capture,
        t.orders_capture_failed as t_orders_capture_failed,
        t.orders_untracked as t_orders_untracked,
        y.sales as y_sales, y.profit_confirmed as y_profit_confirmed,
        w.sales as w_sales, w.orders as w_orders, w.units as w_units,
        w.refunds as w_refunds, w.gross_profit as w_gross, w.payout as w_payout,
        w.profit_confirmed as w_profit_confirmed, w.profit_provisional as w_profit_provisional,
        w.revenue_uncosted as w_revenue_uncosted,
        w.orders_pending_capture as w_orders_pending_capture,
        w.orders_capture_failed as w_orders_capture_failed,
        w.orders_untracked as w_orders_untracked,
        lw.sales as lw_sales, lw.profit_confirmed as lw_profit_confirmed,
        m.sales as m_sales, m.orders as m_orders, m.units as m_units,
        m.refunds as m_refunds, m.gross_profit as m_gross, m.payout as m_payout,
        m.profit_confirmed as m_profit_confirmed, m.profit_provisional as m_profit_provisional,
        m.revenue_uncosted as m_revenue_uncosted,
        m.orders_pending_capture as m_orders_pending_capture,
        m.orders_capture_failed as m_orders_capture_failed,
        m.orders_untracked as m_orders_untracked,
        sm.sales as sm_sales, sm.profit_confirmed as sm_profit_confirmed,
        ytd.sales as ytd_sales, ytd.orders as ytd_orders, ytd.units as ytd_units,
        ytd.refunds as ytd_refunds, ytd.gross_profit as ytd_gross, ytd.payout as ytd_payout,
        ytd.profit_confirmed as ytd_profit_confirmed, ytd.profit_provisional as ytd_profit_provisional,
        ytd.revenue_uncosted as ytd_revenue_uncosted,
        ytd.orders_pending_capture as ytd_orders_pending_capture,
        ytd.orders_capture_failed as ytd_orders_capture_failed,
        ytd.orders_untracked as ytd_orders_untracked,
        ly.sales as ly_sales, ly.profit_confirmed as ly_profit_confirmed
      FROM today t, yesterday y, this_week w, last_week_span lw,
           this_month m, same_period_last_month sm, this_year ytd, same_period_last_year ly`,
      params,
    );

    const r = result[0];
    if (!r) {
      return {
        today: this.emptyPeriod(),
        thisWeek: this.emptyPeriod(),
        thisMonth: this.emptyPeriod(),
        thisYear: this.emptyPeriod(),
      };
    }

    const num = (v: string | undefined) => parseFloat(v || '0') || 0;
    const int = (v: string | undefined) => parseInt(v || '0', 10) || 0;

    return {
      today: this.buildPeriod({
        sales: num(r.t_sales), orders: int(r.t_orders), units: int(r.t_units),
        refunds: int(r.t_refunds), grossProfit: num(r.t_gross), payout: num(r.t_payout),
        profitConfirmed: num(r.t_profit_confirmed),
        profitProvisional: num(r.t_profit_provisional),
        revenueUncosted: num(r.t_revenue_uncosted),
        ordersPendingCapture: int(r.t_orders_pending_capture),
        ordersCaptureFailed: int(r.t_orders_capture_failed),
        ordersUntracked: int(r.t_orders_untracked),
        prevSales: num(r.y_sales), prevProfitConfirmed: num(r.y_profit_confirmed),
      }),
      thisWeek: this.buildPeriod({
        sales: num(r.w_sales), orders: int(r.w_orders), units: int(r.w_units),
        refunds: int(r.w_refunds), grossProfit: num(r.w_gross), payout: num(r.w_payout),
        profitConfirmed: num(r.w_profit_confirmed),
        profitProvisional: num(r.w_profit_provisional),
        revenueUncosted: num(r.w_revenue_uncosted),
        ordersPendingCapture: int(r.w_orders_pending_capture),
        ordersCaptureFailed: int(r.w_orders_capture_failed),
        ordersUntracked: int(r.w_orders_untracked),
        prevSales: num(r.lw_sales), prevProfitConfirmed: num(r.lw_profit_confirmed),
      }),
      thisMonth: this.buildPeriod({
        sales: num(r.m_sales), orders: int(r.m_orders), units: int(r.m_units),
        refunds: int(r.m_refunds), grossProfit: num(r.m_gross), payout: num(r.m_payout),
        profitConfirmed: num(r.m_profit_confirmed),
        profitProvisional: num(r.m_profit_provisional),
        revenueUncosted: num(r.m_revenue_uncosted),
        ordersPendingCapture: int(r.m_orders_pending_capture),
        ordersCaptureFailed: int(r.m_orders_capture_failed),
        ordersUntracked: int(r.m_orders_untracked),
        prevSales: num(r.sm_sales), prevProfitConfirmed: num(r.sm_profit_confirmed),
      }),
      thisYear: this.buildPeriod({
        sales: num(r.ytd_sales), orders: int(r.ytd_orders), units: int(r.ytd_units),
        refunds: int(r.ytd_refunds), grossProfit: num(r.ytd_gross), payout: num(r.ytd_payout),
        profitConfirmed: num(r.ytd_profit_confirmed),
        profitProvisional: num(r.ytd_profit_provisional),
        revenueUncosted: num(r.ytd_revenue_uncosted),
        ordersPendingCapture: int(r.ytd_orders_pending_capture),
        ordersCaptureFailed: int(r.ytd_orders_capture_failed),
        ordersUntracked: int(r.ytd_orders_untracked),
        prevSales: num(r.ly_sales), prevProfitConfirmed: num(r.ly_profit_confirmed),
      }),
    };
  }

  private async getRevenueTrend(
    userId: string,
    days: number,
    ebayAccountId?: string,
  ): Promise<RevenueTrendPoint[]> {
    const offset = days - 1;
    const store = this.storeClause(ebayAccountId, 3);
    const params: (string | number)[] = [userId, offset];
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }

    const cancelled = OrderStatus.CANCELLED;
    const linked = OrderCostCaptureStatus.LINKED;
    const results = await this.databaseService.query<{
      date: Date;
      revenue: string;
      profit: string;
      orders: string;
    }>(
      `SELECT
        DATE(order_date) as date,
        COALESCE(SUM(sale_total) FILTER (WHERE status <> '${cancelled}'), 0) as revenue,
        COALESCE(SUM(net_profit) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = '${linked}'), 0) as profit,
        COUNT(*) FILTER (WHERE status <> '${cancelled}') as orders
       FROM orders
       WHERE user_id = $1 AND order_date >= CURRENT_DATE - INTERVAL '1 day' * $2 ${store.sql}
       GROUP BY DATE(order_date)
       ORDER BY date ASC`,
      params,
    );

    const trendMap = new Map<string, RevenueTrendPoint>();
    for (const row of results) {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
      trendMap.set(dateStr, {
        date: dateStr,
        revenue: parseFloat(row.revenue || '0'),
        profit: parseFloat(row.profit || '0'),
        orders: parseInt(row.orders || '0', 10),
      });
    }

    const trend: RevenueTrendPoint[] = [];
    const now = new Date();
    for (let i = offset; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      trend.push(trendMap.get(dateStr) || { date: dateStr, revenue: 0, profit: 0, orders: 0 });
    }
    return trend;
  }

  private async getChart(
    userId: string,
    ebayAccountId?: string,
  ): Promise<{ points: DashboardChartPoint[]; summary: PeriodMetricsDto }> {
    const store = this.storeClause(ebayAccountId, 2);
    const params: string[] = [userId];
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const sel = this.periodSelect();

    const results = await this.databaseService.query<{
      period: Date;
      sales: string;
      units: string;
      profit_confirmed: string;
      profit_provisional: string;
      revenue_uncosted: string;
      refunds: string;
      orders: string;
      gross_profit: string;
      payout: string;
      orders_pending_capture: string;
      orders_capture_failed: string;
      orders_untracked: string;
    }>(
      `SELECT
        date_trunc('month', order_date)::date as period,
        ${sel}
       FROM orders
       WHERE user_id = $1
         AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         ${store.sql}
       GROUP BY date_trunc('month', order_date)
       ORDER BY period ASC`,
      params,
    );

    type MonthRollup = DashboardChartPoint & {
      orders: number;
      grossProfit: number;
      payout: number;
      profitConfirmed: number;
      profitProvisional: number;
      revenueUncosted: number;
      ordersPendingCapture: number;
      ordersCaptureFailed: number;
      ordersUntracked: number;
    };
    const byMonth = new Map<string, MonthRollup>();
    for (const row of results) {
      const periodStr =
        row.period instanceof Date
          ? row.period.toISOString().split('T')[0]
          : String(row.period).slice(0, 10);
      byMonth.set(periodStr, {
        period: periodStr,
        sales: parseFloat(row.sales || '0'),
        units: parseInt(row.units || '0', 10),
        netProfit: parseFloat(row.profit_confirmed || '0'),
        refunds: parseInt(row.refunds || '0', 10),
        orders: parseInt(row.orders || '0', 10),
        grossProfit: parseFloat(row.gross_profit || '0'),
        payout: parseFloat(row.payout || '0'),
        profitConfirmed: parseFloat(row.profit_confirmed || '0'),
        profitProvisional: parseFloat(row.profit_provisional || '0'),
        revenueUncosted: parseFloat(row.revenue_uncosted || '0'),
        ordersPendingCapture: parseInt(row.orders_pending_capture || '0', 10),
        ordersCaptureFailed: parseInt(row.orders_capture_failed || '0', 10),
        ordersUntracked: parseInt(row.orders_untracked || '0', 10),
      });
    }

    // Fill last 12 months including current
    const points: DashboardChartPoint[] = [];
    let sumSales = 0;
    let sumOrders = 0;
    let sumUnits = 0;
    let sumRefunds = 0;
    let sumGross = 0;
    let sumPayout = 0;
    let sumProfitConfirmed = 0;
    let sumProfitProvisional = 0;
    let sumRevenueUncosted = 0;
    let sumOrdersPendingCapture = 0;
    let sumOrdersCaptureFailed = 0;
    let sumOrdersUntracked = 0;

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().split('T')[0];
      const point = byMonth.get(key) || {
        period: key,
        sales: 0,
        units: 0,
        netProfit: 0,
        refunds: 0,
        orders: 0,
        grossProfit: 0,
        payout: 0,
        profitConfirmed: 0,
        profitProvisional: 0,
        revenueUncosted: 0,
        ordersPendingCapture: 0,
        ordersCaptureFailed: 0,
        ordersUntracked: 0,
      };
      points.push({
        period: point.period,
        sales: point.sales,
        units: point.units,
        netProfit: point.netProfit,
        refunds: point.refunds,
      });
      sumSales += point.sales;
      sumOrders += point.orders;
      sumUnits += point.units;
      sumRefunds += point.refunds;
      sumGross += point.grossProfit;
      sumPayout += point.payout;
      sumProfitConfirmed += point.profitConfirmed;
      sumProfitProvisional += point.profitProvisional;
      sumRevenueUncosted += point.revenueUncosted;
      sumOrdersPendingCapture += point.ordersPendingCapture;
      sumOrdersCaptureFailed += point.ordersCaptureFailed;
      sumOrdersUntracked += point.ordersUntracked;
    }

    return {
      points,
      summary: this.buildPeriod({
        sales: sumSales,
        orders: sumOrders,
        units: sumUnits,
        refunds: sumRefunds,
        grossProfit: sumGross,
        payout: sumPayout,
        profitConfirmed: sumProfitConfirmed,
        profitProvisional: sumProfitProvisional,
        revenueUncosted: sumRevenueUncosted,
        ordersPendingCapture: sumOrdersPendingCapture,
        ordersCaptureFailed: sumOrdersCaptureFailed,
        ordersUntracked: sumOrdersUntracked,
        prevSales: 0,
        prevProfitConfirmed: 0,
      }),
    };
  }

  private async getHistory(
    userId: string,
    ebayAccountId?: string,
  ): Promise<{ months: DashboardHistoryMonth[] }> {
    const store = this.storeClause(ebayAccountId, 2);
    const params: string[] = [userId];
    if (ebayAccountId) {
      params.push(ebayAccountId);
    }
    const cancelled = OrderStatus.CANCELLED;
    const linked = OrderCostCaptureStatus.LINKED;
    const provisional = OrderCostCaptureStatus.PROVISIONAL;

    const results = await this.databaseService.query<{
      period: Date;
      sales: string;
      units: string;
      orders: string;
      refunds: string;
      ad_fee: string;
      amazon_shipping: string;
      purchase_price: string;
      transaction_fee: string;
      ebay_earnings: string;
      gross_profit: string;
      profit: string;
      profit_confirmed: string;
      profit_provisional: string;
      payout: string;
    }>(
      `SELECT
        date_trunc('month', order_date)::date as period,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN sale_total ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN quantity ELSE 0 END), 0) as units,
        COUNT(*) FILTER (WHERE status <> '${cancelled}') as orders,
        COUNT(*) FILTER (WHERE status = '${cancelled}') as refunds,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(ad_fee, 0) ELSE 0 END), 0) as ad_fee,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(amazon_shipping, 0) ELSE 0 END), 0) as amazon_shipping,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(purchase_price, 0) ELSE 0 END), 0) as purchase_price,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(transaction_fee, 0) ELSE 0 END), 0) as transaction_fee,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(ebay_earnings, 0) ELSE 0 END), 0) as ebay_earnings,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}'
          THEN COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0) ELSE 0 END), 0) as gross_profit,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN net_profit ELSE 0 END), 0) as profit,
        COALESCE(SUM(net_profit) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = '${linked}'), 0) as profit_confirmed,
        COALESCE(SUM(net_profit) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = '${provisional}'), 0) as profit_provisional,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(ebay_earnings, 0) ELSE 0 END), 0) as payout
       FROM orders
       WHERE user_id = $1
         AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         ${store.sql}
       GROUP BY date_trunc('month', order_date)
       ORDER BY period DESC`,
      params,
    );

    const byMonth = new Map<string, DashboardHistoryMonth>();
    for (const row of results) {
      const periodDate = row.period instanceof Date ? row.period : new Date(String(row.period));
      const y = periodDate.getUTCFullYear();
      const m = periodDate.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const dateFrom = `${key}-01`;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const dateTo = `${key}-${String(lastDay).padStart(2, '0')}`;
      const sales = parseFloat(row.sales || '0');
      const profit = parseFloat(row.profit || '0');
      const profitConfirmed = parseFloat(row.profit_confirmed || '0');
      byMonth.set(key, {
        key,
        dateFrom,
        dateTo,
        sales,
        units: parseInt(row.units || '0', 10),
        orders: parseInt(row.orders || '0', 10),
        refunds: parseInt(row.refunds || '0', 10),
        adFee: parseFloat(row.ad_fee || '0'),
        amazonShipping: parseFloat(row.amazon_shipping || '0'),
        purchasePrice: parseFloat(row.purchase_price || '0'),
        transactionFee: parseFloat(row.transaction_fee || '0'),
        ebayEarnings: parseFloat(row.ebay_earnings || '0'),
        grossProfit: parseFloat(row.gross_profit || '0'),
        netProfit: profit,
        profitConfirmed,
        profitProvisional: parseFloat(row.profit_provisional || '0'),
        estimatedPayout: parseFloat(row.payout || '0'),
        margin: sales > 0 ? Math.round((profitConfirmed / sales) * 1000) / 10 : 0,
      });
    }

    // Newest first (current month first), fill missing months
    const months: DashboardHistoryMonth[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const existing = byMonth.get(key);
      if (existing) {
        // Mark current month key as "current" for FE label
        if (i === 0) {
          months.push({ ...existing, key: 'current' });
        } else {
          months.push(existing);
        }
      } else {
        const dateFrom = `${key}-01`;
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const dateTo = `${key}-${String(lastDay).padStart(2, '0')}`;
        months.push({
          key: i === 0 ? 'current' : key,
          dateFrom,
          dateTo,
          sales: 0,
          units: 0,
          orders: 0,
          refunds: 0,
          adFee: 0,
          amazonShipping: 0,
          purchasePrice: 0,
          transactionFee: 0,
          ebayEarnings: 0,
          grossProfit: 0,
          netProfit: 0,
          profitConfirmed: 0,
          profitProvisional: 0,
          estimatedPayout: 0,
          margin: 0,
        });
      }
    }

    return { months };
  }

  private async getRecentOrders(userId: string, ebayAccountId?: string): Promise<OrderDto[]> {
    interface RecentOrderRow {
      id: string;
      ebay_order_id: string;
      sale_total: string | null;
      sale_price: string | null;
      sale_shipping: string | null;
      sale_tax: string | null;
      ebay_earnings: string | null;
      purchase_price: string | null;
      transaction_fee: string | null;
      ad_fee: string | null;
      net_profit: string | null;
      cost_capture_status: string | null;
      status: string;
      order_date: Date | null;
      updated_at: Date;
      quantity: number;
      listing_id: string | null;
      listing_title: string | null;
      listing_asin: string | null;
      product_image_urls: string[] | string | null;
    }
    const params: string[] = [userId];
    let storeSql = '';
    if (ebayAccountId) {
      storeSql = ' AND o.ebay_account_id = $2';
      params.push(ebayAccountId);
    }

    const results = await this.databaseService.query<RecentOrderRow>(
      `SELECT
        o.id, o.ebay_order_id,
        o.sale_total, o.sale_price, o.sale_shipping, o.sale_tax,
        o.ebay_earnings, o.purchase_price, o.transaction_fee, o.ad_fee,
        o.net_profit, o.cost_capture_status,
        o.status, o.order_date, o.updated_at, o.quantity,
        o.listing_id,
        l.title as listing_title,
        l.asin as listing_asin,
        p.image_urls as product_image_urls
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN products p ON l.product_id = p.id
       WHERE o.user_id = $1 ${storeSql}
       ORDER BY o.order_date DESC NULLS LAST
       LIMIT 3`,
      params,
    );

    const num = (v: string | null | undefined) => parseFloat(v || '0') || 0;

    return results.map((row) => {
      const imageUrl = row.product_image_urls
        ? (() => {
            const urls = Array.isArray(row.product_image_urls)
              ? row.product_image_urls
              : (() => {
                  try {
                    const parsed: unknown = JSON.parse(String(row.product_image_urls));
                    return Array.isArray(parsed)
                      ? parsed.filter((v: unknown): v is string => typeof v === 'string')
                      : [];
                  } catch {
                    return [];
                  }
                })();
            return urls[0] || undefined;
          })()
        : undefined;

      return {
        id: row.id,
        ebayOrderId: row.ebay_order_id,
        createdAt: (row.order_date || row.updated_at).toISOString(),
        isTracked: !!row.listing_id,
        status: row.status as OrderStatus,
        costCaptureStatus: (row.cost_capture_status as OrderCostCaptureStatus) ?? undefined,
        salePrice: num(row.sale_price),
        saleShipping: num(row.sale_shipping),
        saleTax: num(row.sale_tax),
        saleTotal: num(row.sale_total),
        ebayEarnings: num(row.ebay_earnings),
        purchasePrice: num(row.purchase_price),
        netProfit: num(row.net_profit),
        transactionFee: num(row.transaction_fee),
        adFee: num(row.ad_fee),
        product: row.listing_id
          ? {
              title: row.listing_title || 'Unknown Product',
              asin: row.listing_asin ?? undefined,
              quantity: row.quantity,
              imageUrl,
            }
          : undefined,
      };
    });
  }
}
