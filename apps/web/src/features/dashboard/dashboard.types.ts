/**
 * Dashboard feature-wide types (shared by the page, panels and hooks).
 */

import type {
  DashboardChartGranularity,
  DashboardChartPoint,
  DashboardChartSeries,
  DashboardPnlColumn,
  DashboardPnlGroup,
  DashboardRangeInput,
  DashboardTab,
  DashboardValueFormat,
  PeriodMetricsDto,
  TopListingSortKey,
} from '@repo/shared';

/** Calendar window behind a period card, as the API resolved it. */
export interface PeriodDateInfo {
  dateRange: string;
  from: string;
  to: string;
}

/** The i18n key that names a period card (`count` for "n days ago"). */
export interface PeriodLabelKey {
  key: string;
  count?: number;
}

/** Locale-aware formatters resolved once in the page container. */
export interface DashboardFormatters {
  currency: (value: number) => string;
  compactCurrency: (value: number) => string;
  number: (value: number) => string;
  percent: (value: number) => string;
  date: (isoDate: string) => string;
  /** Short month + year, e.g. "Dec 2029". */
  monthLabel: (isoDate: string) => string;
  /** Signed percentage badge text, or undefined when there is no comparable period. */
  trend: (trend: number | null | undefined) => string | undefined;
  /** X-axis label for a chart bucket (`YYYY-MM-DD`, or `YYYY-MM-DD HH` for hours). */
  bucketLabel: (bucketKey: string, granularity: DashboardChartGranularity) => string;
  /** Full label used inside the chart tooltip. */
  bucketLongLabel: (bucketKey: string, granularity: DashboardChartGranularity) => string;
  /** P&L column header for a day, week or month column. */
  pnlColumnLabel: (column: DashboardPnlColumn, granularity: DashboardChartGranularity) => string;
  /** A window as text: one day → "07.10.2026", otherwise "01 Oct – 07 Oct". */
  dateRange: (from: string, to: string) => string;
  /** A window in all-numeric dates with the year: "15.09.2026 – 22.09.2026". */
  numericDateRange: (from: string, to: string) => string;
  /** The weekday of a calendar date, e.g. "Wednesday". */
  weekday: (isoDate: string) => string;
}

/** URL-backed dashboard state (tab, date range, selected card, top sellers' sort and page). */
export interface DashboardUrlState {
  tab: DashboardTab;
  range: DashboardRangeInput;
  /** Index of the selected period card (0 = the range itself). */
  card: number;
  /** Top sellers tab: the ranking (`?tsort=`, revenue by default). */
  topSort: TopListingSortKey;
  /** Top sellers tab: 1-based page (`?tpage=`). */
  topPage: number;
  setTab: (tab: DashboardTab) => void;
  setRange: (range: DashboardRangeInput) => void;
  setCard: (index: number) => void;
  /** Also returns to the first page. */
  setTopSort: (sort: TopListingSortKey) => void;
  setTopPage: (page: number) => void;
}

/** One row of the P&L matrix / chart summary panel. */
export interface DashboardMetricRow {
  key: string;
  group: DashboardPnlGroup;
  /** i18n key (already namespaced) for the row label. */
  labelKey: string;
  format: DashboardValueFormat;
  /** Field on a P&L column. */
  monthField: keyof DashboardPnlColumn;
  /** Field on the chart summary aggregate. */
  summaryField: keyof PeriodMetricsDto;
  /** Totals get a heavier treatment (bold + separator). */
  emphasis?: boolean;
  /** Cost rows render as a negative outflow. */
  negative?: boolean;
  /** Ratio that cannot be derived per P&L column — chart summary only. */
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
