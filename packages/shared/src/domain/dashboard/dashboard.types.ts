/**
 * Dashboard Domain Types
 * Sellerboard-style period-based metrics (today / this week / this month / this year)
 */

/** Metrics for a single time period (Sellerboard-style KPI card) */
export interface PeriodMetricsDto {
  sales: number;
  orders: number;
  /** Sum of line quantities sold in period (non-cancelled) */
  units: number;
  /** Cancelled orders count in period */
  refunds: number;
  /** SUM(ebay_earnings - purchase_price) on non-cancelled */
  grossProfit: number;
  netProfit: number;
  /** SUM(ebay_earnings) on non-cancelled */
  estimatedPayout: number;
  /** Net profit / sales * 100 */
  margin: number;
  /** sales / orders when orders > 0 */
  avgOrderValue: number;
  /** Sales % change vs comparable previous period */
  trend: number | null;
  /** Net profit % change vs comparable previous period */
  profitTrend: number | null;
}

export type DashboardPeriodKey = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear';

export interface DashboardMetricsDto {
  today: PeriodMetricsDto;
  thisWeek: PeriodMetricsDto;
  thisMonth: PeriodMetricsDto;
  thisYear: PeriodMetricsDto;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  profit: number;
  orders: number;
}

/** Monthly (or MTD) point for the chart tab */
export interface DashboardChartPoint {
  /** ISO date of period start, e.g. "2026-07-01" */
  period: string;
  sales: number;
  units: number;
  netProfit: number;
  refunds: number;
}

/** One column in the history / P&L matrix */
export interface DashboardHistoryMonth {
  /** "YYYY-MM" or "current" for MTD */
  key: string;
  dateFrom: string;
  dateTo: string;
  sales: number;
  units: number;
  orders: number;
  refunds: number;
  adFee: number;
  amazonShipping: number;
  purchasePrice: number;
  transactionFee: number;
  ebayEarnings: number;
  grossProfit: number;
  netProfit: number;
  estimatedPayout: number;
  margin: number;
}

export interface DashboardDataDto {
  metrics: DashboardMetricsDto;
  revenueTrend: RevenueTrendPoint[];
  chart: {
    points: DashboardChartPoint[];
    summary: PeriodMetricsDto;
  };
  history: {
    months: DashboardHistoryMonth[];
  };
  recentOrders: import('../orders/orders.types').OrderDto[];
}
