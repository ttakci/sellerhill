/**
 * Dashboard Domain Types
 */

export interface DashboardMetricsDto {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  activeListings: number;
  todayOrders: number;
  todayRevenue: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface DashboardDataDto {
  metrics: DashboardMetricsDto;
  revenueTrend: RevenueTrendPoint[];
  recentOrders: import('../orders/orders.types').OrderDto[];
}
