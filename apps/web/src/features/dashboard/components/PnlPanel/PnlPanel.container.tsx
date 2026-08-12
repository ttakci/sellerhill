/**
 * PnlPanel Container
 * Builds the P&L matrix (grouped rows × month columns), owns the heat-map
 * toggle and produces the client-side CSV export.
 */

import {
  DASHBOARD_CURRENT_PERIOD_KEY,
  DashboardValueFormat,
  type DashboardHistoryMonth,
} from '@repo/shared';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DASHBOARD_GROUP_ORDER, PNL_MATRIX_ROWS } from '../../utils/metricRows';
import { buildPnlCsv, downloadCsv, heatIntensity } from '../../utils/pnlExport';

import { PnlPanelComponent } from './PnlPanel.component';
import type { PnlPanelContainerProps, PnlSection } from './PnlPanel.types';

/** Ceiling opacity of a heat-map cell — keeps the number readable. */
const HEAT_MAX_OPACITY = 0.18;

const rawValue = (month: DashboardHistoryMonth, field: keyof DashboardHistoryMonth): number => {
  const value = month[field];
  return typeof value === 'number' ? value : 0;
};

export const PnlPanel = ({
  months,
  formatters,
  isLoading,
}: PnlPanelContainerProps): React.ReactElement => {
  const { t } = useTranslation(['dashboard']);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  const columns = useMemo(
    () =>
      months.map((month) =>
        month.key === DASHBOARD_CURRENT_PERIOD_KEY
          ? t('dashboard.pnl.currentPeriod')
          : formatters.monthLabel(month.dateFrom),
      ),
    [months, formatters, t],
  );

  const sections = useMemo<PnlSection[]>(() => {
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

    return DASHBOARD_GROUP_ORDER.map((group) => ({
      group,
      label: t(`dashboard.groups.${group}` as 'dashboard.groups.revenue'),
      rows: PNL_MATRIX_ROWS.filter((row) => row.group === group).map((row) => {
        const values = months.map((month) => rawValue(month, row.monthField));
        return {
          key: row.key,
          label: t(row.labelKey as 'dashboard.metrics.sales'),
          emphasis: Boolean(row.emphasis),
          cells: months.map((month, index) => ({
            key: `${row.key}-${month.dateFrom}`,
            value: formatValue(row.format, values[index], row.negative),
            intensity: heatIntensity(values[index], values) * HEAT_MAX_OPACITY,
            positive: row.negative ? false : values[index] >= 0,
          })),
        };
      }),
    })).filter((section) => section.rows.length > 0);
  }, [months, formatters, t]);

  const handleExport = useCallback(() => {
    const csv = buildPnlCsv({
      parameterLabel: t('dashboard.pnl.parameter'),
      columnLabels: columns,
      rows: PNL_MATRIX_ROWS.map((row) => ({
        label: t(row.labelKey as 'dashboard.metrics.sales'),
        values: months.map((month) => rawValue(month, row.monthField)),
      })),
    });
    const stamp = months[0]?.dateTo ?? months[0]?.dateFrom ?? '';
    downloadCsv(`sellerhill-pnl-${stamp}.csv`, csv);
  }, [columns, months, t]);

  const isEmpty = !isLoading && months.length === 0;

  return (
    <PnlPanelComponent
      title={t('dashboard.pnl.title')}
      subtitle={t('dashboard.pnl.subtitle')}
      parameterLabel={t('dashboard.pnl.parameter')}
      heatmapLabel={t('dashboard.pnl.heatmap')}
      exportLabel={t('dashboard.pnl.export')}
      emptyLabel={t('dashboard.noData')}
      columns={columns}
      sections={sections}
      heatmapEnabled={heatmapEnabled}
      onToggleHeatmap={setHeatmapEnabled}
      onExport={handleExport}
      isEmpty={isEmpty}
    />
  );
};
