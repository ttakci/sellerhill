import type { StoreSettingsResponse } from '@repo/shared';

export type BlacklistScope = 'both' | 'title' | 'description';

export interface BlacklistListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
}

export interface BlacklistListDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  items: Array<{ keyword: string; scope: BlacklistScope }>;
  onRemove: (keyword: string, scope: BlacklistScope) => void;
  emptyMessage: string;
}
