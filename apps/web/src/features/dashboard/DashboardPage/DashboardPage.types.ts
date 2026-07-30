/**
 * DashboardPage types
 */

import type { DashboardTab } from '@repo/shared';
import type { DropdownItem, IconName } from '@repo/ui';

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
  /** Store filter — hidden when the user has no connected eBay store. */
  storeSelectorLabel: string;
  storeSelectorTitle: string;
  storeItems: DropdownItem[];
  showStoreSelector: boolean;
  cardsProps: CardsPanelProps;
  chartProps: ChartPanelContainerProps;
  pnlProps: PnlPanelContainerProps;
}
