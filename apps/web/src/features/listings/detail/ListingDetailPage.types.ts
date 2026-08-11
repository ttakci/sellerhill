import type { ListingDto, ListingStatus, UpdateListingFormData } from '@repo/shared';
import type { UseFormReturn } from 'react-hook-form';

export interface ListingDetailSelectOption {
  id: string;
  name: string;
}

/** Simplified automation UI → maps to DB override columns on save. */
export interface ListingOverridesUiState {
  /** Pause sales → disableOrdering (qty 0) */
  pauseSales: boolean;
  /** Fixed price → lockPrice + disableRepricing */
  fixedPrice: boolean;
  /** Fixed quantity → lockQuantity */
  fixedQuantity: boolean;
  priceOverride: string;
  quantityOverride: string;
  marginPercentOverride: string;
  marginFixedOverride: string;
}

export interface ListingDetailPageProps {
  listing: ListingDto | undefined;
  isLoading: boolean;
  isSaving: boolean;
  isSavingOverrides: boolean;
  isActionLoading: boolean;
  form: UseFormReturn<UpdateListingFormData>;
  listingSettingsGroups: ListingDetailSelectOption[];
  strategyGroupLabel: string;
  /** Read-only — eBay policy reassignment from this page is not pushed to eBay yet. */
  paymentPolicyLabel: string;
  shippingPolicyLabel: string;
  returnPolicyLabel: string;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  isTitleDrawerOpen: boolean;
  onOpenTitleDrawer: () => void;
  onCloseTitleDrawer: () => void;
  isAutomationDrawerOpen: boolean;
  onOpenAutomationDrawer: () => void;
  onCloseAutomationDrawer: () => void;
  overrides: ListingOverridesUiState;
  onOverrideChange: (patch: Partial<ListingOverridesUiState>) => void;
  onSaveOverrides: () => void;
  /** Comma-joined labels of active automation toggles, or a "none" placeholder. */
  automationSummary: string;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  /** Date + clock time — used for record timestamps (created / updated). */
  formatDateTime: (value: string) => string;
  onBack: () => void;
  onSave: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onManage: () => void;
  isRevisionsDrawerOpen: boolean;
  hasRevisions: boolean;
  onOpenRevisions: () => void;
  onCloseRevisions: () => void;
  canEnd: boolean;
  canDelete: boolean;
  canPublish: boolean;
  statusLabel: string;
  statusTone: ListingStatus;
}
