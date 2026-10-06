import type { CampaignListingDto } from '@repo/shared';
import type { ChangeEvent } from 'react';

export interface EditCampaignRateDrawerProps {
  storeId: string;
  campaignId: string;
  members: CampaignListingDto[];
  listingId?: string;
  initialRate: number | null;
  writable: boolean;
  onClose: () => void;
}
export interface EditCampaignRateDrawerComponentProps {
  isDefault: boolean;
  isRetry: boolean;
  rate: string;
  rateError?: string;
  feedback: string | null;
  failedMembers: CampaignListingDto[];
  isSaving: boolean;
  writable: boolean;
  onRateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onClose: () => void;
}
