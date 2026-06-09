/**
 * Dashboard Domain Types
 * Sellerboard-style period-based metrics
 */

/** Metrics for a single time period */
export interface PeriodMetricsDto {
  sales: number;
  orders: number;
  netProfit: number;
  margin: number;
  /** Percentage change vs comparable previous period, null when no baseline */
  trend: number | null;
}

export interface DashboardMetricsDto {
  today: PeriodMetricsDto;
  yesterday: PeriodMetricsDto;
  thisMonth: PeriodMetricsDto;
  thisMonthForecast: PeriodMetricsDto | null;
  lastMonth: PeriodMetricsDto;
  activeListings: number;
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
