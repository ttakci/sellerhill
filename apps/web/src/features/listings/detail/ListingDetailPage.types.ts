import type { ListingDto, ListingStatus, UpdateListingFormData } from '@repo/shared';
import type { IconName } from '@repo/ui';
import type { UseFormReturn } from 'react-hook-form';

export interface ListingDetailSelectOption {
  id: string;
  name: string;
}

/** A rule's current state: genuinely on/off, or "na" when the configuration
 *  makes it moot (custom margin while fixed price is on) — distinct from
 *  "off" so the row explains itself instead of just looking unset. */
export type AutomationRuleState = 'on' | 'off' | 'na';

/** One row of the Otomasyon Durumu card — a rule + its current state +
 *  (when on or n/a) the value/reason backing that state. */
export interface AutomationStatusItem {
  key: string;
  icon: IconName;
  label: string;
  state: AutomationRuleState;
  detail?: string;
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
  /** Listeleme Ayar Grubu card facts — pre-formatted, "—" when unavailable. */
  groupDefaultQuantityLabel: string;
  groupStockBufferLabel: string;
  groupMarginSummaryLabel: string;
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
  /** Per-rule breakdown backing the Otomasyon Durumu card — always 4 rows. */
  automationStatusItems: AutomationStatusItem[];
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
