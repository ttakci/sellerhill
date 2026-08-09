/**
 * CardsPanel types
 */

import type { DashboardPeriodKey, ListingDto, OrderDto, PeriodMetricsDto } from '@repo/shared';

import type { DashboardFormatters, PeriodDateInfo } from '../../dashboard.types';
import type { PeriodCardLabels } from '../PeriodCard';

/** One period card entry, fully resolved by the page container. */
export interface PeriodCardEntry {
  key: DashboardPeriodKey;
  title: string;
  dates: PeriodDateInfo;
  metrics: PeriodMetricsDto;
  gradient: string;
}

export interface CardsPanelProps {
  periods: PeriodCardEntry[];
  selectedPeriod: DashboardPeriodKey;
  onPeriodSelect: (period: DashboardPeriodKey) => void;
  formatters: DashboardFormatters;
  cardLabels: PeriodCardLabels;
  isLoading: boolean;
  listings: ListingDto[];
  orders: OrderDto[];
  onListingOpen: (listingId: string) => void;
  onListingsViewAll: () => void;
  onOrderOpen: (orderId: string) => void;
  onOrdersViewAll: () => void;
  listingsTitle: string;
  listingsViewAllLabel: string;
  listingsEmptyTitle: string;
  listingsEmptySubtitle: string;
  ordersTitle: string;
  ordersViewAllLabel: string;
  ordersEmptyTitle: string;
  ordersEmptySubtitle: string;
}
