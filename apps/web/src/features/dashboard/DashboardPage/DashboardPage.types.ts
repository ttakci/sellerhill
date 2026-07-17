/**
 * DashboardPage Types
 */

import type {
  DashboardDataDto,
  DashboardPeriodKey,
  EbayAccountPublicDto,
  ListingDto,
  OrderDto,
  PeriodMetricsDto,
  UserDto,
} from '@repo/shared';

export type { DashboardPeriodKey };

export interface PeriodDateInfo {
  dateRange: string;
  from: string;
  to: string;
}

export interface PeriodCardLabels {
  sales: string;
  ordersUnits: string;
  refunds: string;
  grossProfit: string;
  netProfit: string;
  estimatedPayout: string;
}

export type DashboardTabId = 'cards' | 'chart' | 'history';

export interface DashboardPageComponentProps {
  user: UserDto | null;
  dashboardData?: DashboardDataDto;
  isLoading: boolean;
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  selectedPeriod: DashboardPeriodKey;
  onPeriodSelect: (period: DashboardPeriodKey) => void;
  periodDates: Record<DashboardPeriodKey, PeriodDateInfo>;
  listings: ListingDto[];
  listingsTotal: number;
  orders: OrderDto[];
  ordersTotal: number;
  onListingOpen: (listingId: string) => void;
  onListingsViewAll: () => void;
  onOrderOpen: (orderId: string) => void;
  onOrdersViewAll: () => void;
  ebayAccounts: EbayAccountPublicDto[];
  selectedStoreId: string;
  onStoreSelect: (storeId: string) => void;
  isTR: boolean;
  formatCurrency: (value: number) => string;
  formatCompactCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
  formatTrend: (trend: number | null | undefined) => string | undefined;
  cardHeaderColors: Record<DashboardPeriodKey, string>;
  labels: PeriodCardLabels;
  periodTitles: Record<DashboardPeriodKey, string>;
  listingsViewAllLabel: string;
  ordersViewAllLabel: string;
  listingsEmptyTitle: string;
  listingsEmptySubtitle: string;
  ordersEmptyTitle: string;
  ordersEmptySubtitle: string;
  tabLabels: Record<DashboardTabId, string>;
}

export interface PeriodCardViewProps {
  title: string;
  dateRange: string;
  metrics: PeriodMetricsDto;
  headerBg: string;
  isActive: boolean;
  onClick: () => void;
  formatCurrency: (v: number) => string;
  formatTrend: (trend: number | null | undefined) => string | undefined;
  labels: PeriodCardLabels;
}
