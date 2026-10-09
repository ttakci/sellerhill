/**
 * PnlPanel Container
 * Builds the P&L matrix (grouped rows × day/week/month columns of the selected
 * range), owns the heat-map toggle and produces the client-side CSV export.
 */

import { DashboardChartGranularity, DashboardValueFormat, type DashboardPnlColumn } from '@repo/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DASHBOARD_GROUP_ORDER, PNL_MATRIX_ROWS } from '../../utils/metricRows';
import { buildPnlCsv, downloadCsv, heatIntensity } from '../../utils/pnlExport';

import { PnlPanelComponent } from './PnlPanel.component';
import type { PnlColumnHeader, PnlPanelContainerProps, PnlSection } from './PnlPanel.types';

/**
 * The caption under the column that contains the seller's today. The column
 * keeps its date ("09 Oct"): a bare "Current period" in its place read as a
 * total of the whole range. P&L columns are never hourly.
 */
const CURRENT_CAPTION_KEY: Record<DashboardChartGranularity, string> = {
  [DashboardChartGranularity.HOUR]: 'dashboard.pnl.currentDay',
  [DashboardChartGranularity.DAY]: 'dashboard.pnl.currentDay',
  [DashboardChartGranularity.WEEK]: 'dashboard.pnl.currentWeek',
  [DashboardChartGranularity.MONTH]: 'dashboard.pnl.currentMonth',
};

/** Ceiling opacity of a heat-map cell — keeps the number readable. */
const HEAT_MAX_OPACITY = 0.18;

const rawValue = (column: DashboardPnlColumn, field: keyof DashboardPnlColumn): number => {
  const value = column[field];
  return typeof value === 'number' ? value : 0;
};

export const PnlPanel = ({
  columns,
  granularity,
  csvStamp,
  formatters,
  isLoading,
}: PnlPanelContainerProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard']);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  const columnLabels = useMemo(
    () => columns.map((column) => formatters.pnlColumnLabel(column, granularity)),
    [columns, formatters, granularity]
  );

  const columnHeaders = useMemo<PnlColumnHeader[]>(
    () =>
      columns.map((column, index) => ({
        key: column.key,
        label: columnLabels[index],
        caption: column.isCurrent ? t(CURRENT_CAPTION_KEY[granularity]) : undefined,
        isCurrent: column.isCurrent,
      })),
    [columns, columnLabels, granularity, t]
  );

  const sections = useMemo<PnlSection[]>(() => {
    const formatValue = (format: DashboardValueFormat, value: number, negative?: boolean): string => {
      if (format === DashboardValueFormat.PERCENT) {
        return formatters.percent(value);
      }
      if (format === DashboardValueFormat.NUMBER) {
        return formatters.number(value);
      }
      const text = formatters.currency(value);
      return negative && value > 0 ? `−${text}` : text;
    };

    return DASHBOARD_GROUP_ORDER.map((group) => ({
      group,
      label: t(`dashboard.groups.${group}` as 'dashboard.groups.revenue'),
      rows: PNL_MATRIX_ROWS.filter((row) => row.group === group).map((row) => {
        const values = columns.map((column) => rawValue(column, row.monthField));
        return {
          key: row.key,
          label: t(row.labelKey as 'dashboard.metrics.sales'),
          emphasis: Boolean(row.emphasis),
          cells: columns.map((column, index) => ({
            key: `${row.key}-${column.key}`,
            value: formatValue(row.format, values[index], row.negative),
            intensity: heatIntensity(values[index], values) * HEAT_MAX_OPACITY,
            positive: row.negative ? false : values[index] >= 0,
          })),
        };
      }),
    })).filter((section) => section.rows.length > 0);
  }, [columns, formatters, t]);

  const handleExport = useCallback(() => {
    const csv = buildPnlCsv({
      parameterLabel: t('dashboard.pnl.parameter'),
      columnLabels,
      rows: PNL_MATRIX_ROWS.map((row) => ({
        label: t(row.labelKey as 'dashboard.metrics.sales'),
        values: columns.map((column) => rawValue(column, row.monthField)),
      })),
    });
    downloadCsv(`sellerhill-pnl-${csvStamp}.csv`, csv);
  }, [columnLabels, columns, csvStamp, t]);

  const isEmpty = !isLoading && columns.length === 0;

  return (
    <PnlPanelComponent
      title={t('dashboard.pnl.title')}
      subtitle={t('dashboard.pnl.subtitle')}
      parameterLabel={t('dashboard.pnl.parameter')}
      heatmapLabel={t('dashboard.pnl.heatmap')}
      exportLabel={t('dashboard.pnl.export')}
      emptyLabel={t('dashboard.noData')}
      columns={columnHeaders}
      sections={sections}
      heatmapEnabled={heatmapEnabled}
      onToggleHeatmap={setHeatmapEnabled}
      onExport={handleExport}
      isEmpty={isEmpty}
    />
  );
};
