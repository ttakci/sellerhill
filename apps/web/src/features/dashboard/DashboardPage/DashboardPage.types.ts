/**
 * DashboardPage types
 */

import type { DashboardTab } from '@repo/shared';
import type { DateRangePickerProps, IconName } from '@repo/ui';

import type { CardsPanelProps } from '../components/CardsPanel';
import type { ChartPanelContainerProps } from '../components/ChartPanel/ChartPanel.types';
import type { PnlPanelContainerProps } from '../components/PnlPanel/PnlPanel.types';

export interface DashboardTabItem {
  id: DashboardTab;
  label: string;
  icon: IconName;
}

export interface DashboardPageComponentProps {
  title: string;
  subtitle: string;
  tabs: DashboardTabItem[];
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  /** The date filter; null until the first answer brings the seller's today. */
  rangePickerProps: DateRangePickerProps | null;
  cardsProps: CardsPanelProps;
  chartProps: ChartPanelContainerProps;
  pnlProps: PnlPanelContainerProps;
}
