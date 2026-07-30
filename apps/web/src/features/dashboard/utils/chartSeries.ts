/**
 * Chart series helpers — one place that decides which figure and which formatter
 * belongs to each toggleable series.
 */

import { DashboardChartSeries, type DashboardChartPoint } from '@repo/shared';

import type { DashboardFormatters } from '../dashboard.types';

/** Ordered series ids as rendered in the legend. */
export const CHART_SERIES_ORDER: DashboardChartSeries[] = [
  DashboardChartSeries.NET_PROFIT,
  DashboardChartSeries.SALES,
  DashboardChartSeries.UNITS,
  DashboardChartSeries.REFUNDS,
];

/** Raw value of `series` for a chart bucket. */
export function seriesValue(series: DashboardChartSeries, point: DashboardChartPoint): number {
  switch (series) {
    case DashboardChartSeries.NET_PROFIT:
      return point.netProfit;
    case DashboardChartSeries.SALES:
      return point.sales;
    case DashboardChartSeries.UNITS:
      return point.units;
    case DashboardChartSeries.REFUNDS:
      return point.refunds;
    default:
      return 0;
  }
}

/** Currency series use the money formatter, count series the number formatter. */
export function formatSeriesValue(
  series: DashboardChartSeries,
  point: DashboardChartPoint,
  formatters: DashboardFormatters,
): string {
  const value = seriesValue(series, point);
  const isCurrency =
    series === DashboardChartSeries.NET_PROFIT || series === DashboardChartSeries.SALES;
  return isCurrency ? formatters.currency(value) : formatters.number(value);
}

/** True when every bucket is empty — lets the panel show an empty state instead of a flat chart. */
export function isChartEmpty(points: DashboardChartPoint[]): boolean {
  return points.every(
    (p) => p.sales === 0 && p.units === 0 && p.netProfit === 0 && p.refunds === 0,
  );
}
