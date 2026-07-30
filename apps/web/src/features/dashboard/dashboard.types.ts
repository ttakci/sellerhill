/**
 * Dashboard feature-wide types (shared by the page, panels and hooks).
 */

import type {
  DashboardChartGranularity,
  DashboardChartPoint,
  DashboardChartSeries,
  DashboardHistoryMonth,
  DashboardPeriodKey,
  DashboardPnlGroup,
  DashboardTab,
  DashboardValueFormat,
  PeriodMetricsDto,
} from '@repo/shared';

/** Resolved calendar range behind a period card. */
export interface PeriodDateInfo {
  dateRange: string;
  from: string;
  to: string;
}

/** Locale-aware formatters resolved once in the page container. */
export interface DashboardFormatters {
  currency: (value: number) => string;
  compactCurrency: (value: number) => string;
  number: (value: number) => string;
  percent: (value: number) => string;
  date: (isoDate: string) => string;
  /** Short month + year, e.g. "Dec 2029" — P&L column headers. */
  monthLabel: (isoDate: string) => string;
  /** Signed percentage badge text, or undefined when there is no comparable period. */
  trend: (trend: number | null | undefined) => string | undefined;
  /** X-axis / column label for a chart bucket. */
  bucketLabel: (isoDate: string, granularity: DashboardChartGranularity) => string;
  /** Full label used inside the chart tooltip. */
  bucketLongLabel: (isoDate: string, granularity: DashboardChartGranularity) => string;
}

/** URL-backed dashboard state (tab, period, store, chart granularity). */
export interface DashboardUrlState {
  tab: DashboardTab;
  period: DashboardPeriodKey;
  storeId: string;
  granularity: DashboardChartGranularity;
  setTab: (tab: DashboardTab) => void;
  setPeriod: (period: DashboardPeriodKey) => void;
  setStoreId: (storeId: string) => void;
  setGranularity: (granularity: DashboardChartGranularity) => void;
}

/** One row of the P&L matrix / chart summary panel. */
export interface DashboardMetricRow {
  key: string;
  group: DashboardPnlGroup;
  /** i18n key (already namespaced) for the row label. */
  labelKey: string;
  format: DashboardValueFormat;
  /** Field on a P&L month column. */
  monthField: keyof DashboardHistoryMonth;
  /** Field on the chart summary aggregate. */
  summaryField: keyof PeriodMetricsDto;
  /** Totals get a heavier treatment (bold + separator). */
  emphasis?: boolean;
  /** Cost rows render as a negative outflow. */
  negative?: boolean;
  /** Ratio that cannot be derived per month column — chart summary only. */
  summaryOnly?: boolean;
}

/** Chart series descriptor used for the legend chips and the recharts config. */
export interface ChartSeriesConfig {
  id: DashboardChartSeries;
  label: string;
  color: string;
  visible: boolean;
}

/** Chart point enriched with its rendered axis label. */
export interface ChartPointView extends DashboardChartPoint {
  label: string;
}
