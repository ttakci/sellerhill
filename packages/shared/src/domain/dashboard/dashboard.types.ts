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
  /** Headline net profit = linked (trusted) only. Equals profitConfirmed. */
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
  /**
   * Tiered profit aggregates by cost-capture confidence.
   * Headline `netProfit` = `profitConfirmed` (linked orders only, trusted costs).
   */
  profitConfirmed: number;
  /** SUM(net_profit) where cost_capture_status = 'provisional' (product-only costs). */
  profitProvisional: number;
  /** SUM(sale_total) where cost_capture_status in ('pending','failed','untracked'). */
  revenueUncosted: number;
  /** # of non-cancelled orders with cost_capture_status = 'pending'. */
  ordersPendingCapture: number;
  /** # of non-cancelled orders with cost_capture_status = 'failed'. */
  ordersCaptureFailed: number;
  /** # of non-cancelled orders with cost_capture_status = 'untracked'. */
  ordersUntracked: number;
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
  /** Linked-only net profit (trusted costs) — same definition as PeriodMetricsDto.profitConfirmed. */
  profitConfirmed: number;
  /** Provisional net profit (product-only costs). */
  profitProvisional: number;
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
