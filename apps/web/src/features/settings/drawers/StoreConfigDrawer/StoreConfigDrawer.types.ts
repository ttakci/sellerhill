import type { StoreSettingsResponse } from '@repo/shared';

/** A store selectable as a config target in create mode. */
export interface StoreConfigStoreOption {
  id: string;
  name: string;
}

export interface StoreConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** `null` = create mode; present = edit mode (prefilled, scope fixed). */
  editingConfig: StoreSettingsResponse | null;
  /** eBay accounts usable as targets when creating a new config. */
  availableStores: StoreConfigStoreOption[];
  /** All existing configs — used to filter create-mode targets and resolve names. */
  existingConfigs: StoreSettingsResponse[];
}

export interface StoreConfigDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** Read-only scope label shown in edit mode (e.g. "Global" or store name). */
  scopeLabel: string;
  /** Whether the scope selector is read-only (always true in edit mode). */
  isScopeReadonly: boolean;
  scopeOptions: StoreConfigStoreOption[];
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
  onSave: () => void;
  isSaving: boolean;
  isSaveDisabled: boolean;
}
