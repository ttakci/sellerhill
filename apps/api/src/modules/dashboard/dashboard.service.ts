/**
 * Dashboard Service
 * Sellerboard-style period-based metrics: today, yesterday, this month, forecast, last month
 */

import { Injectable, Logger } from '@nestjs/common';
import { ListingStatus, OrderStatus, type DashboardDataDto, type DashboardMetricsDto, type OrderDto, type PeriodMetricsDto, type RevenueTrendPoint } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get complete dashboard data for a user
   */
  async getDashboard(userId: string, days?: number): Promise<DashboardDataDto> {
    const safeDays = Math.max(7, Math.min(90, days || 14));
    const [metrics, revenueTrend, recentOrders] = await Promise.all([
      this.getMetrics(userId),
      this.getRevenueTrend(userId, safeDays),
      this.getRecentOrders(userId),
    ]);

    return { metrics, revenueTrend, recentOrders };
  }

  /**
   * Calculate percentage change. Returns null when previous is 0.
   */
  private calcChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  /**
   * Build a PeriodMetricsDto from raw numbers.
   */
  private buildPeriod(sales: number, profit: number, orders: number, prevSales: number, _prevProfit: number, _prevOrders: number): PeriodMetricsDto {
    return {
      sales,
      orders,
      netProfit: profit,
      margin: sales > 0 ? Math.round((profit / sales) * 1000) / 10 : 0,
      trend: this.calcChange(sales, prevSales),
    };
  }

  /**
   * Get period-based metrics (Sellerboard-style).
   * Single CTE query: today, yesterday, this_month, same_period_last_month,
   * last_month, month_before_last, month_meta (for forecast calc).
   */
  private async getMetrics(userId: string): Promise<DashboardMetricsDto> {
    const result = await this.databaseService.query<{
      today_sales: string; today_profit: string; today_orders: string;
      yest_sales: string; yest_profit: string; yest_orders: string;
      day_before_sales: string; day_before_profit: string; day_before_orders: string;
      month_sales: string; month_profit: string; month_orders: string;
      same_sales: string; same_profit: string; same_orders: string;
      last_sales: string; last_profit: string; last_orders: string;
      prev_sales: string; prev_profit: string; prev_orders: string;
      day_of_month: string; days_in_month: string;
    }>(
      `WITH today AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as today_sales,
          COALESCE(SUM(net_profit), 0) as today_profit,
          COUNT(*) as today_orders
        FROM orders
        WHERE user_id = $1 AND order_date >= CURRENT_DATE
      ),
      yesterday AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as yest_sales,
          COALESCE(SUM(net_profit), 0) as yest_profit,
          COUNT(*) as yest_orders
        FROM orders
        WHERE user_id = $1
          AND order_date >= CURRENT_DATE - INTERVAL '1 day'
          AND order_date < CURRENT_DATE
      ),
      day_before AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as db_sales,
          COALESCE(SUM(net_profit), 0) as db_profit,
          COUNT(*) as db_orders
        FROM orders
        WHERE user_id = $1
          AND order_date >= CURRENT_DATE - INTERVAL '2 days'
          AND order_date < CURRENT_DATE - INTERVAL '1 day'
      ),
      this_month AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as month_sales,
          COALESCE(SUM(net_profit), 0) as month_profit,
          COUNT(*) as month_orders
        FROM orders
        WHERE user_id = $1
          AND order_date >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      same_period_last_month AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as same_sales,
          COALESCE(SUM(net_profit), 0) as same_profit,
          COUNT(*) as same_orders
        FROM orders, (
          SELECT EXTRACT(DAY FROM CURRENT_DATE)::int as dom
        ) meta
        WHERE user_id = $1
          AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
          AND order_date < DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                       + meta.dom * INTERVAL '1 day'
      ),
      last_month AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as last_sales,
          COALESCE(SUM(net_profit), 0) as last_profit,
          COUNT(*) as last_orders
        FROM orders
        WHERE user_id = $1
          AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
          AND order_date < DATE_TRUNC('month', CURRENT_DATE)
      ),
      month_before_last AS (
        SELECT
          COALESCE(SUM(sale_total), 0) as prev_sales,
          COALESCE(SUM(net_profit), 0) as prev_profit,
          COUNT(*) as prev_orders
        FROM orders
        WHERE user_id = $1
          AND order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months'
          AND order_date < DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
      ),
      month_meta AS (
        SELECT
          EXTRACT(DAY FROM CURRENT_DATE)::int as day_of_month,
          EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::int as days_in_month
      )
      SELECT
        t.today_sales, t.today_profit, t.today_orders,
        y.yest_sales, y.yest_profit, y.yest_orders,
        db.db_sales as day_before_sales, db.db_profit as day_before_profit, db.db_orders as day_before_orders,
        tm.month_sales, tm.month_profit, tm.month_orders,
        sp.same_sales, sp.same_profit, sp.same_orders,
        lm.last_sales, lm.last_profit, lm.last_orders,
        mbl.prev_sales, mbl.prev_profit, mbl.prev_orders,
        mm.day_of_month, mm.days_in_month
      FROM today t, yesterday y, day_before db, this_month tm,
           same_period_last_month sp, last_month lm, month_before_last mbl, month_meta mm`,
      [userId],
    );

    // Active listings (separate table)
    const listingStats = await this.databaseService.query<{ active_listings: string }>(
      `SELECT COUNT(*) as active_listings FROM listings WHERE user_id = $1 AND status = $2`,
      [userId, ListingStatus.ACTIVE],
    );

    const r = result[0] || {};
    const num = (v: string | undefined, fallback = '0') => parseFloat(v || fallback);

    const todaySales = num(r.today_sales);
    const todayProfit = num(r.today_profit);
    const todayOrders = parseInt(r.today_orders || '0', 10);
    const yestSales = num(r.yest_sales);
    const yestProfit = num(r.yest_profit);
    const yestOrders = parseInt(r.yest_orders || '0', 10);
    const dbSales = num(r.day_before_sales);
    const dbProfit = num(r.day_before_profit);
    const dbOrders = parseInt(r.day_before_orders || '0', 10);
    const monthSales = num(r.month_sales);
    const monthProfit = num(r.month_profit);
    const monthOrders = parseInt(r.month_orders || '0', 10);
    const sameSales = num(r.same_sales);
    const sameProfit = num(r.same_profit);
    const sameOrders = parseInt(r.same_orders || '0', 10);
    const lastSales = num(r.last_sales);
    const lastProfit = num(r.last_profit);
    const lastOrders = parseInt(r.last_orders || '0', 10);
    const prevSales = num(r.prev_sales);
    const prevProfit = num(r.prev_profit);
    const prevOrders = parseInt(r.prev_orders || '0', 10);
    const dayOfMonth = parseInt(r.day_of_month || '1', 10);
    const daysInMonth = parseInt(r.days_in_month || '30', 10);

    // Forecast: project this month's data to end of month
    const forecastMultiplier = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;
    const forecastSales = Math.round(monthSales * forecastMultiplier * 100) / 100;
    const forecastProfit = Math.round(monthProfit * forecastMultiplier * 100) / 100;
    const forecastOrders = Math.round(monthOrders * forecastMultiplier);

    return {
      today: this.buildPeriod(todaySales, todayProfit, todayOrders, yestSales, yestProfit, yestOrders),
      yesterday: this.buildPeriod(yestSales, yestProfit, yestOrders, dbSales, dbProfit, dbOrders),
      thisMonth: this.buildPeriod(monthSales, monthProfit, monthOrders, sameSales, sameProfit, sameOrders),
      thisMonthForecast: monthOrders > 0
        ? this.buildPeriod(forecastSales, forecastProfit, forecastOrders, lastSales, lastProfit, lastOrders)
        : null,
      lastMonth: this.buildPeriod(lastSales, lastProfit, lastOrders, prevSales, prevProfit, prevOrders),
      activeListings: parseInt(listingStats[0]?.active_listings || '0', 10),
    };
  }

  /**
   * Get revenue trend for charts
   */
  private async getRevenueTrend(userId: string, days: number = 14): Promise<RevenueTrendPoint[]> {
    const offset = days - 1;
    const results = await this.databaseService.query<{
      date: Date;
      revenue: string;
      profit: string;
      orders: string;
    }>(
      `SELECT
        DATE(order_date) as date,
        COALESCE(SUM(sale_total), 0) as revenue,
        COALESCE(SUM(net_profit), 0) as profit,
        COUNT(*) as orders
       FROM orders
       WHERE user_id = $1 AND order_date >= CURRENT_DATE - INTERVAL '1 day' * $2
       GROUP BY DATE(order_date)
       ORDER BY date ASC`,
      [userId, offset],
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

  /**
   * Get 3 most recent orders
   */
  private async getRecentOrders(userId: string): Promise<OrderDto[]> {
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
       WHERE o.user_id = $1
       ORDER BY o.order_date DESC NULLS LAST
       LIMIT 3`,
      [userId],
    );

    return results.map((row) => {
      const imageUrl = row.product_image_urls
        ? (() => {
            const urls = Array.isArray(row.product_image_urls)
              ? row.product_image_urls
              : (() => {
                  try {
                    const parsed: unknown = JSON.parse(String(row.product_image_urls));
                    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string') : [];
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
