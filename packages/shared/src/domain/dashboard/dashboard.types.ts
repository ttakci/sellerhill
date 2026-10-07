/**
 * Dashboard Domain Types
 * One date range (a preset or a custom from/to, on the seller's calendar day)
 * drives four period cards, the chart (hour|day|week|month buckets) and the
 * P&L matrix (day|week|month columns). See `dashboard-range.ts`.
 */

import type { DashboardPeriodLabel, DashboardRangePreset } from './dashboard-range';

/** Dashboard tab ids (URL `?tab=`). */
export enum DashboardTab {
  CARDS = 'cards',
  CHART = 'chart',
  PNL = 'pnl',
}

/**
 * Chart / P&L bucket size. Derived from the range length by
 * `dashboardGranularityFor` — never chosen by the seller.
 */
export enum DashboardChartGranularity {
  /** One point per hour — ranges of up to 2 days (chart only). */
  HOUR = 'hour',
  /** One point per day — ranges of up to 31 days. */
  DAY = 'day',
  /** One point per ISO week (Monday start) — ranges of up to 92 days. */
  WEEK = 'week',
  /** One point per calendar month — longer ranges. */
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
  /** SUM(sale_total) where cost_capture_status in ('pending','failed'). */
  revenueUncosted: number;
  /** # of non-cancelled orders with cost_capture_status = 'pending'. */
  ordersPendingCapture: number;
  /** # of non-cancelled orders with cost_capture_status = 'failed'. */
  ordersCaptureFailed: number;
  /**
   * # of non-cancelled orders in the period with no SellerHill listing
   * (`listing_id IS NULL`). These are EXCLUDED from every other figure in this
   * DTO — the dashboard describes the business SellerHill manages, not the
   * whole eBay store — and this count exists so the card can say so.
   */
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

/** One bucket on the chart tab (hour, day, week or month depending on granularity) */
export interface DashboardChartPoint {
  /** Bucket key — `YYYY-MM-DD`, or `YYYY-MM-DD HH` for hourly. */
  period: string;
  sales: number;
  units: number;
  orders: number;
  /** Confirmed (linked) net profit only — same trust rule as the period cards. */
  netProfit: number;
  grossProfit: number;
  refunds: number;
}

/** One P&L column (was DashboardHistoryMonth): a day, week or month of the range. */
export interface DashboardPnlColumn {
  /** Bucket key (YYYY-MM-DD of the bucket start). */
  key: string;
  dateFrom: string;
  dateTo: string;
  /** The column that contains today. */
  isCurrent: boolean;
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

export interface DashboardRangeDto {
  preset: DashboardRangePreset | null;
  from: string;
  to: string;
  /** Seller-local today (YYYY-MM-DD). */
  today: string;
  timezone: string;
  chartGranularity: DashboardChartGranularity;
  pnlGranularity: DashboardChartGranularity;
}

export interface DashboardPeriodDto {
  from: string;
  to: string;
  label: DashboardPeriodLabel;
  metrics: PeriodMetricsDto;
}

export interface DashboardDataDto {
  range: DashboardRangeDto;
  /** 4 cards, newest first. */
  periods: DashboardPeriodDto[];
  chart: {
    granularity: DashboardChartGranularity;
    points: DashboardChartPoint[];
    summary: PeriodMetricsDto;
  };
  pnl: { granularity: DashboardChartGranularity; columns: DashboardPnlColumn[] };
}

export interface DashboardStoreMetrics {
  ebayAccountId: string;
  metrics: PeriodMetricsDto;
}
