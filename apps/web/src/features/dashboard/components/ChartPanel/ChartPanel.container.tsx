/**
 * ChartPanel Container
 * Owns series visibility, resolves the theme palette and builds the summary rail
 * from the canonical metric row definitions.
 */

import {
  DashboardChartGranularity,
  DashboardChartSeries,
  DashboardValueFormat,
} from '@repo/shared';
import { useTheme } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChartSeriesConfig } from '../../dashboard.types';
import { CHART_SERIES_ORDER, formatSeriesValue, isChartEmpty } from '../../utils/chartSeries';
import { DASHBOARD_GROUP_ORDER, DASHBOARD_METRIC_ROWS } from '../../utils/metricRows';

import { ChartPanelComponent } from './ChartPanel.component';
import type {
  ChartPanelContainerProps,
  ChartSummaryRow,
  ChartSummarySection,
} from './ChartPanel.types';

export const ChartPanel = ({
  points,
  summary,
  granularity,
  onGranularityChange,
  formatters,
  isLoading,
}: ChartPanelContainerProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard']);
  const { theme } = useTheme();
  const [hiddenSeries, setHiddenSeries] = useState<DashboardChartSeries[]>([]);

  const seriesColors = useMemo(
    () => ({
      [DashboardChartSeries.NET_PROFIT]: theme.colors.dashboard.seriesProfit,
      [DashboardChartSeries.SALES]: theme.colors.dashboard.seriesSales,
      [DashboardChartSeries.UNITS]: theme.colors.dashboard.seriesUnits,
      [DashboardChartSeries.REFUNDS]: theme.colors.dashboard.seriesRefunds,
    }),
    [theme],
  );

  const series = useMemo<ChartSeriesConfig[]>(
    () =>
      CHART_SERIES_ORDER.map((id) => ({
        id,
        label: t(`dashboard.chart.series.${id}` as 'dashboard.chart.series.netProfit'),
        color: seriesColors[id],
        visible: !hiddenSeries.includes(id),
      })),
    [t, seriesColors, hiddenSeries],
  );

  const granularityOptions = useMemo(
    () =>
      Object.values(DashboardChartGranularity).map((value) => ({
        value,
        label: t(`dashboard.chart.granularity.${value}` as 'dashboard.chart.granularity.month'),
      })),
    [t],
  );

  const summarySections = useMemo<ChartSummarySection[]>(() => {
    const formatValue = (
      format: DashboardValueFormat,
      value: number,
      negative?: boolean,
    ): string => {
      if (format === DashboardValueFormat.PERCENT) {
        return formatters.percent(value);
      }
      if (format === DashboardValueFormat.NUMBER) {
        return formatters.number(value);
      }
      const text = formatters.currency(value);
      return negative && value > 0 ? `−${text}` : text;
    };

    return DASHBOARD_GROUP_ORDER.map((group) => {
      const rows: ChartSummaryRow[] = DASHBOARD_METRIC_ROWS.filter(
        (row) => row.group === group,
      ).map((row) => {
        const raw = summary[row.summaryField];
        const value = typeof raw === 'number' ? raw : 0;
        return {
          key: row.key,
          label: t(row.labelKey as 'dashboard.metrics.sales'),
          value: formatValue(row.format, value, row.negative),
          emphasis: row.emphasis,
          tone: row.emphasis ? (value >= 0 ? 'positive' : 'negative') : 'default',
        };
      });
      return {
        group,
        label: t(`dashboard.groups.${group}` as 'dashboard.groups.revenue'),
        rows,
      };
    }).filter((section) => section.rows.length > 0);
  }, [summary, formatters, t]);

  const handleToggleSeries = useCallback((id: DashboardChartSeries) => {
    setHiddenSeries((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  }, []);

  const handleGranularityChange = useCallback(
    (value: string) => {
      onGranularityChange(value as DashboardChartGranularity);
    },
    [onGranularityChange],
  );

  const formatTick = useCallback(
    (period: string) => formatters.bucketLabel(period, granularity),
    [formatters, granularity],
  );

  const formatTooltipTitle = useCallback(
    (period: string) => formatters.bucketLongLabel(period, granularity),
    [formatters, granularity],
  );

  const formatValueForSeries = useCallback(
    (id: DashboardChartSeries, point: Parameters<typeof formatSeriesValue>[1]) =>
      formatSeriesValue(id, point, formatters),
    [formatters],
  );

  const isEmpty = !isLoading && (points.length === 0 || isChartEmpty(points));

  return (
    <ChartPanelComponent
      title={t('dashboard.chart.title')}
      subtitle={t('dashboard.chart.subtitle')}
      summaryTitle={t('dashboard.chart.summary')}
      emptyLabel={t('dashboard.noData')}
      data={points}
      series={series}
      summarySections={summarySections}
      granularityOptions={granularityOptions}
      granularityValue={granularity}
      onGranularityChange={handleGranularityChange}
      onToggleSeries={handleToggleSeries}
      formatTick={formatTick}
      formatAxisCurrency={formatters.compactCurrency}
      formatTooltipTitle={formatTooltipTitle}
      formatSeriesValue={formatValueForSeries}
      gridColor={theme.colors.border.primary}
      axisColor={theme.colors.text.tertiary}
      axisFontSize={theme.typography.fontSize.xs}
      barRadius={theme.radiusPx.xs}
      isEmpty={isEmpty}
    />
  );
};
