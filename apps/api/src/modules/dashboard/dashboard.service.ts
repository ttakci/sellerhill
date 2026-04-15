/**
 * Dashboard Service
 * Provides real-time metrics and aggregated data for the user's dashboard
 */

import { Injectable, Logger } from '@nestjs/common';
import { ListingStatus, type DashboardDataDto, type DashboardMetricsDto, type OrderDto, type RevenueTrendPoint } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get complete dashboard data for a user
   */
  async getDashboard(userId: string): Promise<DashboardDataDto> {
    const [metrics, revenueTrend, recentOrders] = await Promise.all([
      this.getMetrics(userId),
      this.getRevenueTrend(userId),
      this.getRecentOrders(userId),
    ]);

    return {
      metrics,
      revenueTrend,
      recentOrders,
    };
  }

  /**
   * Get key metrics for the user
   */
  private async getMetrics(userId: string): Promise<DashboardMetricsDto> {
    // Order stats
    const orderStats = await this.databaseService.query<{
      total_revenue: string;
      total_profit: string;
      total_orders: string;
      today_orders: string;
      today_revenue: string;
    }>(
      `SELECT
        COALESCE(SUM(sale_total), 0) as total_revenue,
        COALESCE(SUM(net_profit), 0) as total_profit,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_orders,
        COALESCE(SUM(sale_total) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today_revenue
       FROM orders WHERE user_id = $1`,
      [userId]
    );

    // Active listings count
    const listingStats = await this.databaseService.query<{ active_listings: string }>(
      `SELECT COUNT(*) as active_listings FROM listings WHERE user_id = $1 AND status = '${ListingStatus.ACTIVE}'`,
      [userId]
    );

    const stat = orderStats[0] || {};

    return {
      totalRevenue: parseFloat(stat.total_revenue || '0'),
      totalProfit: parseFloat(stat.total_profit || '0'),
      totalOrders: parseInt(stat.total_orders || '0', 10),
      activeListings: parseInt(listingStats[0]?.active_listings || '0', 10),
      todayOrders: parseInt(stat.today_orders || '0', 10),
      todayRevenue: parseFloat(stat.today_revenue || '0'),
    };
  }

  /**
   * Get 14-day revenue trend for charts
   */
  private async getRevenueTrend(userId: string): Promise<RevenueTrendPoint[]> {
    const results = await this.databaseService.query<{
      date: Date;
      revenue: string;
      profit: string;
      orders: string;
    }>(
      `SELECT
        DATE(created_at) as date,
        COALESCE(SUM(sale_total), 0) as revenue,
        COALESCE(SUM(net_profit), 0) as profit,
        COUNT(*) as orders
       FROM orders
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId]
    );

    // Fill in missing days with zeros
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
    for (let i = 13; i >= 0; i--) {
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
      product_title: string | null;
      sale_total: string;
      net_profit: string;
      status: string;
      is_tracked: boolean;
      created_at: Date;
      quantity: number;
      asin: string | null;
      product_image_url: string | null;
    }
    const results = await this.databaseService.query<RecentOrderRow>(
      `SELECT
        o.id, o.ebay_order_id, o.product_title, o.sale_total, o.net_profit,
        o.status, o.is_tracked, o.created_at, o.quantity, o.asin, o.product_image_url
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 3`,
      [userId]
    );

    return results.map((row) => ({
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      createdAt: row.created_at.toISOString(),
      isTracked: row.is_tracked,
      status: row.status,
      salePrice: 0,
      saleShipping: 0,
      saleTax: 0,
      saleTotal: parseFloat(row.sale_total) || 0,
      ebayEarnings: 0,
      purchasePrice: 0,
      netProfit: parseFloat(row.net_profit) || 0,
      transactionFee: 0,
      adFee: 0,
      product: row.product_title
        ? {
            title: row.product_title,
            asin: row.asin,
            quantity: row.quantity,
            imageUrl: row.product_image_url,
          }
        : undefined,
    }));
  }
}
