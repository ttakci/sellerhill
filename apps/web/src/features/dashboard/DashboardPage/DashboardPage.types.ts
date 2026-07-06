/**
 * DashboardPage Types
 */

import type { DashboardDataDto, EbayAccountPublicDto, ListingDto, UserDto } from '@repo/shared';

export type PeriodKey = 'today' | 'yesterday' | 'thisMonth' | 'thisMonthForecast' | 'lastMonth';

export type PeriodPreset = 'today' | 'week' | 'month';

export interface PeriodDateInfo {
  dateRange: string;
}

export interface DashboardPageComponentProps {
  user: UserDto | null;
  dashboardData?: DashboardDataDto;
  selectedPeriod: PeriodKey;
  onPeriodSelect: (period: PeriodKey) => void;
  periodPreset: PeriodPreset;
  onPeriodPresetChange: (preset: PeriodPreset) => void;
  selectedDays: number;
  onDaysChange: (days: number) => void;
  periodDates: Record<PeriodKey, PeriodDateInfo>;
  listings: ListingDto[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredListingId: string | null;
  onListingSelect: (listingId: string | null) => void;
  ebayAccounts: EbayAccountPublicDto[];
  selectedStoreId: string;
  onStoreSelect: (storeId: string) => void;
  isTR: boolean;
  formatCurrency: (value: number) => string;
  formatCompactCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
  /* presentation-only derived values (computed in container) */
  showSearch: boolean;
  onShowSearchChange: (show: boolean) => void;
  cardColors: Record<PeriodKey, string>;
  cardHeaders: Record<PeriodKey, string>;
  labels: { sales: string; orders: string; netProfit: string; margin: string };
  periodTitles: Record<PeriodKey, string>;
  periodPresetOptions: { label: string; value: string }[];
}
