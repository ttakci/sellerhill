import type { ChangeEvent } from 'react';

export interface CreateCampaignDrawerProps {
  storeId: string;
  onClose: () => void;
}
export interface CreateCampaignDrawerComponentProps {
  name: string;
  rate: string;
  nameError?: string;
  rateError?: string;
  error: string | null;
  isSaving: boolean;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onClose: () => void;
}
