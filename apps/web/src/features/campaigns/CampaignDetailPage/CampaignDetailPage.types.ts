import type { CampaignAction, CampaignListingDto, EbayCampaignDetailDto } from '@repo/shared';

import type { CampaignView, MetricView } from '../CampaignsPage/CampaignsPage.types';

export interface CampaignMemberView extends CampaignListingDto {
  priceText: string;
  rateText: string;
  note: string | null;
}
export interface CampaignDetailPageProps {
  detail: EbayCampaignDetailDto | undefined;
  hasStore: boolean;
  isLoading: boolean;
  errorKey: string | null;
  onRetry: () => void;
  onBack: () => void;
  facts: Array<{ label: string; value: string }>;
  campaignView: CampaignView | undefined;
  metrics: MetricView[];
  members: CampaignMemberView[];
  selectedRows: CampaignMemberView[];
  writable: boolean;
  writeReason: string | null;
  busy: boolean;
  feedback: string | null;
  storeId: string | null;
  campaignId: string | undefined;
  addOpen: boolean;
  rateTarget: { listingId?: string; initialRate: number | null; members: CampaignListingDto[] } | null;
  endOpen: boolean;
  lifecycleAction: CampaignAction | null;
  onSelect: (rows: CampaignMemberView[]) => void;
  onRemove: (rows: CampaignListingDto[]) => void;
  onAddOpen: () => void;
  onAddClose: () => void;
  onRateOpen: (member?: CampaignListingDto) => void;
  onRateClose: () => void;
  onAction: (action: CampaignAction) => void;
  onEndOpen: () => void;
  onEndClose: () => void;
}
