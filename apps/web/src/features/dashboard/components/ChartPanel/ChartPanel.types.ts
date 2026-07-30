/**
 * ChartPanel types
 */

import type {
  DashboardChartGranularity,
  DashboardChartPoint,
  DashboardChartSeries,
  DashboardPnlGroup,
  PeriodMetricsDto,
} from '@repo/shared';

import type { ChartSeriesConfig, DashboardFormatters } from '../../dashboard.types';

export interface ChartPanelContainerProps {
  points: DashboardChartPoint[];
  summary: PeriodMetricsDto;
  granularity: DashboardChartGranularity;
  onGranularityChange: (granularity: DashboardChartGranularity) => void;
  formatters: DashboardFormatters;
  isLoading: boolean;
}

/** One row of the right-hand summary rail. */
export interface ChartSummaryRow {
  key: string;
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'default' | 'positive' | 'negative';
}

export interface ChartSummarySection {
  group: DashboardPnlGroup;
  label: string;
  rows: ChartSummaryRow[];
}

export interface ChartGranularityOption {
  label: string;
  value: string;
}

export interface ChartPanelComponentProps {
  title: string;
  subtitle: string;
  summaryTitle: string;
  emptyLabel: string;
  data: DashboardChartPoint[];
  series: ChartSeriesConfig[];
  summarySections: ChartSummarySection[];
  granularityOptions: ChartGranularityOption[];
  granularityValue: string;
  onGranularityChange: (value: string) => void;
  onToggleSeries: (id: DashboardChartSeries) => void;
  /** X-axis tick label for a bucket. */
  formatTick: (period: string) => string;
  /** Left (currency) axis tick label. */
  formatAxisCurrency: (value: number) => string;
  /** Tooltip heading for a bucket. */
  formatTooltipTitle: (period: string) => string;
  /** Tooltip value for one series of one bucket. */
  formatSeriesValue: (id: DashboardChartSeries, point: DashboardChartPoint) => string;
  gridColor: string;
  axisColor: string;
  /** Axis tick size from `typography.fontSize` — never a raw px number. */
  axisFontSize: string;
  /** Bar corner radius from `theme.radiusPx` (SVG needs px, not rem). */
  barRadius: number;
  isEmpty: boolean;
}
