/**
 * PnlPanel types
 */

import type { DashboardChartGranularity, DashboardPnlColumn, DashboardPnlGroup } from '@repo/shared';

import type { DashboardFormatters } from '../../dashboard.types';

export interface PnlPanelContainerProps {
  /** Newest first — a day, week or month of the selected range each. */
  columns: DashboardPnlColumn[];
  granularity: DashboardChartGranularity;
  /** Goes into the CSV file name (the range's last day). */
  csvStamp: string;
  formatters: DashboardFormatters;
  isLoading: boolean;
}

/** One rendered column header. */
export interface PnlColumnHeader {
  key: string;
  label: string;
  /** "Today" / "This week" / "This month" under the current column's label. */
  caption?: string;
  /** The column that contains today — highlighted. */
  isCurrent: boolean;
}

/** One matrix cell: formatted text plus heat-map inputs. */
export interface PnlCell {
  key: string;
  value: string;
  /** 0…1 relative magnitude inside the row. */
  intensity: number;
  positive: boolean;
}

export interface PnlRow {
  key: string;
  label: string;
  emphasis: boolean;
  cells: PnlCell[];
}

export interface PnlSection {
  group: DashboardPnlGroup;
  label: string;
  rows: PnlRow[];
}

export interface PnlPanelComponentProps {
  title: string;
  subtitle: string;
  parameterLabel: string;
  heatmapLabel: string;
  exportLabel: string;
  emptyLabel: string;
  columns: PnlColumnHeader[];
  sections: PnlSection[];
  heatmapEnabled: boolean;
  onToggleHeatmap: (enabled: boolean) => void;
  onExport: () => void;
  isEmpty: boolean;
}
