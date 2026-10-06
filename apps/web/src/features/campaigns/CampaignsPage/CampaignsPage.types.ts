import type { BadgeVariant, ViewMode } from '@repo/ui';

export interface MetricView {
  key: string;
  label: string;
  value: string;
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
  metrics: MetricView[];
}
export interface CampaignsPageProps {
  campaigns: CampaignView[];
  metrics: MetricView[];
  hasStore: boolean;
  isLoading: boolean;
  errorKey: string | null;
  eligibilityMessage: string | null;
  canCreate: boolean;
  viewMode: ViewMode;
  gridMinItemWidth: string;
  onViewModeChange: (mode: ViewMode) => void;
  onRetry: () => void;
  onOpen: (campaignId: string) => void;
  onCreate: () => void;
  drawerStoreId: string | null;
  onCloseDrawer: () => void;
}
