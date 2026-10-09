/**
 * TopSellersPanel types
 */

import type { DashboardRangeInput, TopListingDto, TopListingSortKey } from '@repo/shared';
import type { DataTableProps, TableColumn, ViewMode } from '@repo/ui';
import type React from 'react';

import type { DashboardFormatters } from '../../dashboard.types';
import type { TrendChartColors, TrendChartPoint } from '../TrendChart';

import type { ListingCardProps, ListingCardStat } from '@/domain-ui';

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
  /** The page's date formatters: the trend axis labels a bucket exactly as the Chart tab does. */
  formatters: DashboardFormatters;
  onOpenListing: (listingId: string) => void;
}

/** Everything a top seller's card shows, computed in the container. */
export interface TopSellerCardModel {
  /** The listing card's own props (title, photo, meta rows, status); its stats are replaced by `stats`. */
  card: Omit<ListingCardProps, 'orientation'>;
  /** The range's figures in place of the listing's lifetime ones. */
  stats: ListingCardStat[];
  trend: TopSellerTrendModel;
}

/** One card's trend pane: the bucket values and the texts around them. */
export interface TopSellerTrendModel {
  points: TrendChartPoint[];
  /** "Revenue · daily" */
  title: string;
  peakLabel?: string;
  valueLabel: string;
  color: string;
  formatValue: (value: number) => string;
}

export interface TopSellersPanelComponentProps {
  items: TopListingDto[];
  /** Card view models keyed by listing id. */
  cards: Record<string, TopSellerCardModel>;
  total: number;
  columns: TableColumn<TopListingDto>[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  pagination: NonNullable<DataTableProps<TopListingDto>['pagination']>;
  isLoading: boolean;
  /** The query failed — an error state, never "nothing sold". */
  isError: boolean;
  onRetry: () => void;
  onOpenListing: (listingId: string) => void;
  /** Shared by every card's trend pane. */
  trendColors: Omit<TrendChartColors, 'line'>;
  formatTrendTick: (key: string) => string;
  formatTrendTooltipTitle: (key: string) => string;
  stopCardClick: (event: React.MouseEvent) => void;
}
