/**
 * PnlPanel types
 */

import type { DashboardHistoryMonth, DashboardPnlGroup } from '@repo/shared';

import type { DashboardFormatters } from '../../dashboard.types';

export interface PnlPanelContainerProps {
  months: DashboardHistoryMonth[];
  formatters: DashboardFormatters;
  isLoading: boolean;
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
  columns: string[];
  sections: PnlSection[];
  heatmapEnabled: boolean;
  onToggleHeatmap: (enabled: boolean) => void;
  onExport: () => void;
  isEmpty: boolean;
}
