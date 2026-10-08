import type { ListingDto, ListingStatus, UpdateListingFormData } from '@repo/shared';
import type { IconName } from '@repo/ui';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { SwipeNavigationHandlers } from '@/hooks/useSwipeNavigation';

/** One read-only row of the change-group drawer: a label and one or more value
 *  lines (the margin row lists every tier on its own line). */
export interface GroupDetailRow {
  label: string;
  values: string[];
}

/** A titled block of rows, mirroring one step of the group edit drawer. */
export interface GroupDetailSection {
  key: 'general' | 'deductions' | 'pricing' | 'rules' | 'template';
  title: string;
  rows: GroupDetailRow[];
}

/** Formatting helpers the group-detail view model needs from the container. */
export interface GroupDetailDeps {
  t: TFunction;
  fmtCurrency: (value: number) => string;
  fmtRating: (value: number) => string;
  dash: string;
}

/** The listing fields the template preview is rendered with. */
export interface GroupPreviewListing {
  title: string;
  description?: string;
  features?: string[];
  specs?: Record<string, string>;
  imageUrls?: string[];
}

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

/** One read-only label / value row (the change-group drawer's preview). */
export interface ListingDetailFact {
  label: string;
  value: string;
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
  /** Per-range breakdown for the Kâr Marjı info tooltip — empty when there's
   *  only one range (nothing to break down beyond the summary label itself). */
  groupMarginRangeDetails: string[];
  /** The group picked in the change-group drawer, read-only, in the edit drawer's steps. */
  drawerGroupSections: GroupDetailSection[];
  /** The picked group's template rendered with THIS listing's data ('' = none). */
  drawerGroupPreviewHtml: string;
  /** "N+" when the source only reports a lower bound, formatted via
   *  `formatSourceStock` in the container — never a bare number. */
  amazonStockText: string;
  /** True when the source product page is no longer reachable (404/removed). */
  sourceRemoved: boolean;
  /** Read-only — eBay policy reassignment from this page is not pushed to eBay yet. */
  paymentPolicyLabel: string;
  shippingPolicyLabel: string;
  returnPolicyLabel: string;
  selectedImageIndex: number;
  onSelectImage: (index: number) => void;
  /** Step the gallery back / forward one image (wraps at both ends). */
  onPrevImage: () => void;
  onNextImage: () => void;
  /** Touch swipe over the main photo steps the gallery. */
  gallerySwipeHandlers: SwipeNavigationHandlers;
  /** The thumbnail strip, scrolled so the chosen thumbnail stays in view. */
  thumbRowRef: RefObject<HTMLDivElement>;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  isTitleDrawerOpen: boolean;
  onOpenTitleDrawer: () => void;
  onCloseTitleDrawer: () => void;
  isGroupDrawerOpen: boolean;
  onOpenGroupDrawer: () => void;
  onCloseGroupDrawer: () => void;
  onSaveGroup: () => void;
  isSavingGroup: boolean;
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
  /** Opens the listing's own-store campaign page (campaign pages read the `store` query). */
  onOpenCampaign: (campaignId: string) => void;
  onSave: () => void;
  onEnd: () => void;
  onDelete: () => void;
  onPublish: () => void;
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
