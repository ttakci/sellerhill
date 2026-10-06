import type { EbayCampaignDto } from '@repo/shared';

export interface CampaignsPageProps {
  campaigns: EbayCampaignDto[];
  hasStore: boolean;
  isLoading: boolean;
  errorKey: string | null;
  onRetry: () => void;
  onOpen: (campaignId: string) => void;
}
