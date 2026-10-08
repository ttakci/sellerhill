/**
 * TopSellersPanel types
 */

import type { DashboardRangeInput, TopListingDto, TopListingSortKey } from '@repo/shared';
import type { DataTableProps, TableColumn, ViewMode } from '@repo/ui';
import type { ReactNode } from 'react';

export interface TopSellersPanelProps {
  /** The dashboard's date range — the same window the cards count. */
  range: DashboardRangeInput;
  /** The top bar's active store; nothing is fetched without one. */
  ebayAccountId?: string;
  sortBy: TopListingSortKey;
  /** 1-based page. */
  page: number;
  onSortChange: (sort: TopListingSortKey) => void;
  onPageChange: (page: number) => void;
  /** Number/date locale (separators only — money keeps the listing's currency). */
  locale: string;
  onOpenListing: (listingId: string) => void;
}

export interface TopSellersPanelComponentProps {
  items: TopListingDto[];
  total: number;
  columns: TableColumn<TopListingDto>[];
  renderGridCard: (item: TopListingDto) => ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  pagination: NonNullable<DataTableProps<TopListingDto>['pagination']>;
  isLoading: boolean;
  onRowClick: (row: TopListingDto) => void;
}
