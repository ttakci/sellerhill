import type { BlacklistAction, BlacklistType, StoreSettingsResponse } from '@repo/shared';

export type BlacklistItem = { keyword: string; types: BlacklistType[]; action: BlacklistAction };

export interface BlacklistActionOption {
  value: BlacklistAction;
  label: string;
}

export interface BlacklistTypeOption {
  value: BlacklistType;
  label: string;
}

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
  selectedTypes: BlacklistType[];
  typeOptions: BlacklistTypeOption[];
  onToggleType: (value: BlacklistType) => void;
  /** What a match does: refuse the listing, or strip the word and list anyway. */
  action: BlacklistAction;
  actionOptions: BlacklistActionOption[];
  onActionChange: (value: string) => void;
  actionLabel: string;
  actionHint: string;
  onAdd: () => void;
  errorMessage: string | null;
  // list (filtered by search)
  items: BlacklistItem[];
  /** True when the scope has any keywords at all, regardless of the search filter. */
  hasKeywords: boolean;
  onRemove: (keyword: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedItems: string[];
  onToggleSelect: (keyword: string) => void;
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
  typeLabel: string;
  addLabel: string;
  emptyMessage: string;
  noResultsMessage: string;
  searchPlaceholder: string;
  selectAllLabel: string;
  selectedCountLabel: string;
  bulkDeleteLabel: string;
  // confirm bulk delete
  isConfirmOpen: boolean;
  onOpenConfirm: () => void;
  onCloseConfirm: () => void;
  onConfirmBulkDelete: () => void;
  confirmDescription: string;
  confirmLabel: string;
  cancelLabel: string;
}
