/**
 * Dashboard Domain Types
 * Sellerboard-style period-based metrics (today / this week / this month / this year)
 * + chart (day|week|month buckets) + P&L matrix.
 */

/** Dashboard tab ids (URL `?tab=`). */
export enum DashboardTab {
  CARDS = 'cards',
  CHART = 'chart',
  PNL = 'pnl',
}

/** Period card keys (URL `?period=`). */
export enum DashboardPeriodKey {
  TODAY = 'today',
  THIS_WEEK = 'thisWeek',
  THIS_MONTH = 'thisMonth',
  THIS_YEAR = 'thisYear',
}

/** Chart bucket size (URL `?granularity=`, API `chartGranularity`). */
export enum DashboardChartGranularity {
  /** Last 30 days, one point per day. */
  DAY = 'day',
  /** Last 12 ISO weeks, one point per week. */
  WEEK = 'week',
  /** Last 12 months, one point per month. */
  MONTH = 'month',
}

/** Toggleable chart series (legend chips). */
export enum DashboardChartSeries {
  NET_PROFIT = 'netProfit',
  SALES = 'sales',
  UNITS = 'units',
  REFUNDS = 'refunds',
}

/** P&L matrix / summary panel row groups. */
export enum DashboardPnlGroup {
  REVENUE = 'revenue',
  COSTS = 'costs',
  PROFIT = 'profit',
  RATIOS = 'ratios',
}

/** How a P&L / summary row value is rendered. */
export enum DashboardValueFormat {
  CURRENCY = 'currency',
  NUMBER = 'number',
  PERCENT = 'percent',
}

/**
 * `DashboardHistoryMonth.key` of the month-to-date column.
 * Shared so the API writer and the FE label reader can never drift apart.
 */
export const DASHBOARD_CURRENT_PERIOD_KEY = 'current';

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
  /** SUM(purchase_price) on non-cancelled — Amazon product cost. */
  costOfGoods: number;
  /** SUM(transaction_fee) on non-cancelled (display only, already inside ebay_earnings). */
  transactionFees: number;
  /** SUM(ad_fee) on non-cancelled (display only, already inside ebay_earnings). */
  adFees: number;
  /** SUM(amazon_shipping) on non-cancelled. */
  amazonShipping: number;
  /** SUM(amazon_tax) on non-cancelled. */
  amazonTax: number;
  /** profitConfirmed / costOfGoods * 100 (0 when no product cost is known). */
  roi: number;
  /** refunds / (orders + refunds) * 100. */
  refundRate: number;
}

export type DashboardMetricsDto = Record<DashboardPeriodKey, PeriodMetricsDto>;

/** One bucket on the chart tab (day, week or month depending on granularity) */
export interface DashboardChartPoint {
  /** ISO date of bucket start, e.g. "2026-07-01" */
  period: string;
  sales: number;
  units: number;
  orders: number;
  /** Confirmed (linked) net profit only — same trust rule as the period cards. */
  netProfit: number;
  grossProfit: number;
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
  amazonTax: number;
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
  /** profitConfirmed / purchasePrice * 100 (0 when no product cost is known). */
  roi: number;
}

export interface DashboardDataDto {
  metrics: DashboardMetricsDto;
  chart: {
    /** Echoes the requested bucket size so the FE can label the axis. */
    granularity: DashboardChartGranularity;
    points: DashboardChartPoint[];
    summary: PeriodMetricsDto;
  };
  history: {
    months: DashboardHistoryMonth[];
  };
}
