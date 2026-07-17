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
  businessPolicies: {
    payment: ListingDetailSelectOption[];
    shipping: ListingDetailSelectOption[];
    return: ListingDetailSelectOption[];
  };
  strategyGroupLabel: string;
  paymentPolicyLabel: string;
  shippingPolicyLabel: string;
  returnPolicyLabel: string;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  isEditDrawerOpen: boolean;
  onOpenEditDrawer: () => void;
  onCloseEditDrawer: () => void;
  overrides: ListingOverridesUiState;
  onOverrideChange: (patch: Partial<ListingOverridesUiState>) => void;
  onSaveOverrides: () => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onBack: () => void;
  onSave: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onOpenAmazon: () => void;
  onOpenEbay: () => void;
  onManage: () => void;
  canEnd: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canOpenEbay: boolean;
  statusLabel: string;
  statusTone: ListingStatus;
}
