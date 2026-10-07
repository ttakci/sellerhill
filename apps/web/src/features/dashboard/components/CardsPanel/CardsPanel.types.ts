/**
 * CardsPanel types
 */

import type { ListingDto, OrderDto, PeriodMetricsDto } from '@repo/shared';

import type { DashboardFormatters, PeriodDateInfo } from '../../dashboard.types';
import type { PeriodCardLabels } from '../PeriodCard';

/** One period card entry, fully resolved by the page container. */
export interface PeriodCardEntry {
  /** Position in the API's periods array (0 = the selected range itself). */
  index: number;
  title: string;
  dates: PeriodDateInfo;
  metrics: PeriodMetricsDto;
  gradient: string;
}

export interface CardsPanelProps {
  periods: PeriodCardEntry[];
  /** Index of the selected card. */
  selectedPeriod: number;
  onPeriodSelect: (index: number) => void;
  formatters: DashboardFormatters;
  cardLabels: PeriodCardLabels;
  isLoading: boolean;
  listings: ListingDto[];
  listingsTotal: number;
  orders: OrderDto[];
  ordersTotal: number;
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
