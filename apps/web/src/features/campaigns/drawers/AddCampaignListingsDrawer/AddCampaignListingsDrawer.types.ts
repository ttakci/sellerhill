import type { CampaignListingDto } from '@repo/shared';
import type { SelectOption } from '@repo/ui';
import type { ChangeEvent } from 'react';

export interface AddCampaignListingsDrawerProps {
  storeId: string;
  campaignId: string;
  writable: boolean;
  onClose: () => void;
}
export interface AddCampaignListingsDrawerComponentProps {
  options: SelectOption[];
  group: string;
  groupError: string | null;
  groupsError: boolean;
  filling: boolean;
  search: string;
  items: Array<{ member: CampaignListingDto; checked: boolean }>;
  selected: CampaignListingDto[];
  skipped: number | null;
  pageLabel: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  isLoading: boolean;
  candidatesError: boolean;
  isSaving: boolean;
  writable: boolean;
  feedback: string | null;
  selectionError: string | undefined;
  onGroup: (value: string | number) => void;
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggle: (member: CampaignListingDto, checked: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRetryCandidates: () => void;
  onRetryGroup: () => void;
  onRetryGroups: () => void;
  onSubmit: () => void;
  onClose: () => void;
}
