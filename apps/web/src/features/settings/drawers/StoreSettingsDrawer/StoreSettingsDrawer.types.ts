import type { StoreSettingsResponse } from '@repo/shared';

export interface StoreSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
  /** Hoisted scope — shared with the nested blacklist drawer so both stay in sync. */
  selectedScope: string;
  onSelectScope: (value: string) => void;
  /** Open the nested blacklist management drawer for the selected scope. */
  onManageBlacklist: () => void;
}

export interface StoreSettingsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  country: string;
  state: string;
  zipCode: string;
  validateTitle: boolean;
  validateDescription: boolean;
  onCountryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleValidateTitle: (checked: boolean) => void;
  onToggleValidateDescription: (checked: boolean) => void;
  onContinue: () => void;
  isSaving: boolean;
  isContinueDisabled: boolean;
}
