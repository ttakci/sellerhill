import type { StoreSettingsResponse } from '@repo/shared';

export type BlacklistScope = 'title' | 'description' | 'both';

export interface BlacklistAddDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
}

export interface BlacklistAddDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  keyword: string;
  onKeywordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedScopeValue: BlacklistScope;
  onSelectScopeValue: (value: BlacklistScope) => void;
  onAdd: () => void;
  isSaving: boolean;
  errorMessage: string | null;
}
