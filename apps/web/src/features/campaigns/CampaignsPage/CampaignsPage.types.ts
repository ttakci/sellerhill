import type { BadgeVariant, TabNavItem, ViewMode } from '@repo/ui';
import type { ChangeEvent } from 'react';

/** The list's status tabs. "Other" eBay statuses (scheduled, ending…) show under All only. */
export enum CampaignTab {
  ALL = 'all',
  RUNNING = 'running',
  PAUSED = 'paused',
  ENDED = 'ended',
}

/** What the list can be sorted by; every sort runs over the campaigns already loaded. */
export enum CampaignSortKey {
  SALES = 'sales',
  AD_FEES = 'adFees',
  ROAS = 'roas',
  NAME = 'name',
}

export type CampaignSortDirection = 'asc' | 'desc';

export interface MetricView {
  key: string;
  label: string;
  value: string;
  /** False when eBay has not reported the figure yet (the value is then an em dash). */
  known: boolean;
}
export interface CampaignView {
  campaignId: string;
  name: string;
  status: string;
  statusTone: BadgeVariant;
  strategy: string;
  rateType: string;
  defaultRate: string;
  listingCount: string;
  outsideSellerHill: boolean;
  readOnly: boolean;
  /** ROAS, the card's one large figure. */
  roas: MetricView;
  /** Sales · ad fees · clicks — the card's figures row. */
  stats: MetricView[];
}
export interface CampaignsPageProps {
  campaigns: CampaignView[];
  metrics: MetricView[];
  /** Some figure is still waiting for eBay's report — the hero says so under the strip. */
  metricsPending: boolean;
  hasStore: boolean;
  isLoading: boolean;
  errorKey: string | null;
  eligibilityMessage: string | null;
  canCreate: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tab: CampaignTab;
  tabItems: TabNavItem[];
  onTabChange: (tab: string) => void;
  search: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  resultCount: number;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  onRetry: () => void;
  onOpen: (campaignId: string) => void;
  onCreate: () => void;
  drawerStoreId: string | null;
  onCloseDrawer: () => void;
}
export interface CampaignCardProps {
  campaign: CampaignView;
  onOpen: (campaignId: string) => void;
}
