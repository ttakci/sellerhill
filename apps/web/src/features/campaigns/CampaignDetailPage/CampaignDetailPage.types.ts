import type { EbayCampaignDetailDto } from '@repo/shared';

export interface CampaignDetailPageProps {
  detail: EbayCampaignDetailDto | undefined;
  hasStore: boolean;
  isLoading: boolean;
  errorKey: string | null;
  onRetry: () => void;
  onBack: () => void;
}
