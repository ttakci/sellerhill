import type { StoreSettingsResponse } from '@repo/shared';

export type BlacklistScope = 'title' | 'description' | 'both';

export type BlacklistItem = { keyword: string; scope: BlacklistScope };

export interface BlacklistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
  /** Inherited from the hub — this drawer manages blacklist for this scope only. */
  selectedScope: string;
}

export interface BlacklistDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  // inline add form
  keywords: string;
  onKeywordsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  selectedScopeValue: BlacklistScope;
  onSelectScopeValue: (value: BlacklistScope) => void;
  onAdd: () => void;
  errorMessage: string | null;
  // list (filtered by search)
  items: BlacklistItem[];
  onRemove: (keyword: string, scope: BlacklistScope) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedItems: BlacklistItem[];
  onToggleSelect: (item: BlacklistItem) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  // save
  onSave: () => void;
  isSaving: boolean;
  isSaveDisabled: boolean;
  // pre-resolved labels
  titleLabel: string;
  subtitleLabel: string;
  keywordsLabel: string;
  keywordsPlaceholder: string;
  keywordsHint: string;
  scopeLabel: string;
  scopeBothLabel: string;
  scopeTitleLabel: string;
  scopeDescriptionLabel: string;
  addLabel: string;
  emptyMessage: string;
  searchPlaceholder: string;
  selectAllLabel: string;
  selectedCountLabel: string;
  bulkDeleteLabel: string;
  // confirm bulk delete
  isConfirmOpen: boolean;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
  onConfirmBulkDelete: () => void;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
  cancelLabel: string;
}
