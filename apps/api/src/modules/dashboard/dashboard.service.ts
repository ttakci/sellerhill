/**
 * Dashboard Service
 * Sellerboard-style metrics: today, this week, this month, last month
 * + chart (monthly) + history (P&L matrix)
 */

import { Injectable, Logger } from '@nestjs/common';
import {
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

  private buildPeriod(
    sales: number,
    profit: number,
    orders: number,
    units: number,
    refunds: number,
    grossProfit: number,
    payout: number,
    prevSales: number,
    prevProfit: number,
  ): PeriodMetricsDto {
    return {
      sales,
      orders,
      units,
      refunds,
      grossProfit,
      netProfit: profit,
      estimatedPayout: payout,
      margin: sales > 0 ? Math.round((profit / sales) * 1000) / 10 : 0,
      avgOrderValue: orders > 0 ? Math.round((sales / orders) * 100) / 100 : 0,
      trend: this.calcChange(sales, prevSales),
      profitTrend: this.calcChange(profit, prevProfit),
    };
  }

  private emptyPeriod(): PeriodMetricsDto {
    return this.buildPeriod(0, 0, 0, 0, 0, 0, 0, 0, 0);
  }

  /**
   * Shared SELECT fragment for period aggregates.
   * Non-cancelled for sales metrics; refunds = cancelled count.
   */
  private periodSelect(): string {
    const cancelled = OrderStatus.CANCELLED;
    return `
      COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN sale_total ELSE 0 END), 0) as sales,
      COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN net_profit ELSE 0 END), 0) as profit,
      COUNT(*) FILTER (WHERE status <> '${cancelled}') as orders,
      COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN quantity ELSE 0 END), 0) as units,
      COUNT(*) FILTER (WHERE status = '${cancelled}') as refunds,
      COALESCE(SUM(CASE WHEN status <> '${cancelled}'
        THEN COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0) ELSE 0 END), 0) as gross_profit,
      COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(ebay_earnings, 0) ELSE 0 END), 0) as payout
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
      t_sales: string; t_profit: string; t_orders: string; t_units: string;
      t_refunds: string; t_gross: string; t_payout: string;
      // yesterday (trend)
      y_sales: string; y_profit: string;
      // this week
      w_sales: string; w_profit: string; w_orders: string; w_units: string;
      w_refunds: string; w_gross: string; w_payout: string;
      // last week same span (trend for this week)
      lw_sales: string; lw_profit: string;
      // this month
      m_sales: string; m_profit: string; m_orders: string; m_units: string;
      m_refunds: string; m_gross: string; m_payout: string;
      // same period last month (trend)
      sm_sales: string; sm_profit: string;
      // this year
      ytd_sales: string; ytd_profit: string; ytd_orders: string; ytd_units: string;
      ytd_refunds: string; ytd_gross: string; ytd_payout: string;
      // same YTD span last year (trend)
      ly_sales: string; ly_profit: string;
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
        t.sales as t_sales, t.profit as t_profit, t.orders as t_orders, t.units as t_units,
        t.refunds as t_refunds, t.gross_profit as t_gross, t.payout as t_payout,
        y.sales as y_sales, y.profit as y_profit,
        w.sales as w_sales, w.profit as w_profit, w.orders as w_orders, w.units as w_units,
        w.refunds as w_refunds, w.gross_profit as w_gross, w.payout as w_payout,
        lw.sales as lw_sales, lw.profit as lw_profit,
        m.sales as m_sales, m.profit as m_profit, m.orders as m_orders, m.units as m_units,
        m.refunds as m_refunds, m.gross_profit as m_gross, m.payout as m_payout,
        sm.sales as sm_sales, sm.profit as sm_profit,
        ytd.sales as ytd_sales, ytd.profit as ytd_profit, ytd.orders as ytd_orders, ytd.units as ytd_units,
        ytd.refunds as ytd_refunds, ytd.gross_profit as ytd_gross, ytd.payout as ytd_payout,
        ly.sales as ly_sales, ly.profit as ly_profit
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
      today: this.buildPeriod(
        num(r.t_sales), num(r.t_profit), int(r.t_orders), int(r.t_units),
        int(r.t_refunds), num(r.t_gross), num(r.t_payout),
        num(r.y_sales), num(r.y_profit),
      ),
      thisWeek: this.buildPeriod(
        num(r.w_sales), num(r.w_profit), int(r.w_orders), int(r.w_units),
        int(r.w_refunds), num(r.w_gross), num(r.w_payout),
        num(r.lw_sales), num(r.lw_profit),
      ),
      thisMonth: this.buildPeriod(
        num(r.m_sales), num(r.m_profit), int(r.m_orders), int(r.m_units),
        int(r.m_refunds), num(r.m_gross), num(r.m_payout),
        num(r.sm_sales), num(r.sm_profit),
      ),
      thisYear: this.buildPeriod(
        num(r.ytd_sales), num(r.ytd_profit), int(r.ytd_orders), int(r.ytd_units),
        int(r.ytd_refunds), num(r.ytd_gross), num(r.ytd_payout),
        num(r.ly_sales), num(r.ly_profit),
      ),
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
    const results = await this.databaseService.query<{
      date: Date;
      revenue: string;
      profit: string;
      orders: string;
    }>(
      `SELECT
        DATE(order_date) as date,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN sale_total ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN net_profit ELSE 0 END), 0) as profit,
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
    const cancelled = OrderStatus.CANCELLED;

    const results = await this.databaseService.query<{
      period: Date;
      sales: string;
      units: string;
      profit: string;
      refunds: string;
      orders: string;
      gross_profit: string;
      payout: string;
    }>(
      `SELECT
        date_trunc('month', order_date)::date as period,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN sale_total ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN quantity ELSE 0 END), 0) as units,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN net_profit ELSE 0 END), 0) as profit,
        COUNT(*) FILTER (WHERE status = '${cancelled}') as refunds,
        COUNT(*) FILTER (WHERE status <> '${cancelled}') as orders,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}'
          THEN COALESCE(ebay_earnings, 0) - COALESCE(purchase_price, 0) ELSE 0 END), 0) as gross_profit,
        COALESCE(SUM(CASE WHEN status <> '${cancelled}' THEN COALESCE(ebay_earnings, 0) ELSE 0 END), 0) as payout
       FROM orders
       WHERE user_id = $1
         AND order_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
         ${store.sql}
       GROUP BY date_trunc('month', order_date)
       ORDER BY period ASC`,
      params,
    );

    const byMonth = new Map<string, DashboardChartPoint & { orders: number; grossProfit: number; payout: number }>();
    for (const row of results) {
      const periodStr =
        row.period instanceof Date
          ? row.period.toISOString().split('T')[0]
          : String(row.period).slice(0, 10);
      byMonth.set(periodStr, {
        period: periodStr,
        sales: parseFloat(row.sales || '0'),
        units: parseInt(row.units || '0', 10),
        netProfit: parseFloat(row.profit || '0'),
        refunds: parseInt(row.refunds || '0', 10),
        orders: parseInt(row.orders || '0', 10),
        grossProfit: parseFloat(row.gross_profit || '0'),
        payout: parseFloat(row.payout || '0'),
      });
    }

    // Fill last 12 months including current
    const points: DashboardChartPoint[] = [];
    let sumSales = 0;
    let sumProfit = 0;
    let sumOrders = 0;
    let sumUnits = 0;
    let sumRefunds = 0;
    let sumGross = 0;
    let sumPayout = 0;

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
      };
      points.push({
        period: point.period,
        sales: point.sales,
        units: point.units,
        netProfit: point.netProfit,
        refunds: point.refunds,
      });
      sumSales += point.sales;
      sumProfit += point.netProfit;
      sumOrders += point.orders;
      sumUnits += point.units;
      sumRefunds += point.refunds;
      sumGross += point.grossProfit;
      sumPayout += point.payout;
    }

    return {
      points,
      summary: this.buildPeriod(
        sumSales, sumProfit, sumOrders, sumUnits, sumRefunds, sumGross, sumPayout, 0, 0,
      ),
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
        estimatedPayout: parseFloat(row.payout || '0'),
        margin: sales > 0 ? Math.round((profit / sales) * 1000) / 10 : 0,
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
      sale_total: string;
      net_profit: string;
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
        o.id, o.ebay_order_id, o.sale_total, o.net_profit,
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
        salePrice: 0,
        saleShipping: 0,
        saleTax: 0,
        saleTotal: parseFloat(row.sale_total) || 0,
        ebayEarnings: 0,
        purchasePrice: 0,
        netProfit: parseFloat(row.net_profit) || 0,
        transactionFee: 0,
        adFee: 0,
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
