import type { ListingSettingsGroupFormData, ListingTemplatePlaceholder } from '@repo/shared';
import type React from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form';

export type ListingGroupDrawerStep = 0 | 1 | 2 | 3 | 4;

/** What to do with a listing that is not selling. */
export enum ColdListingMode {
  FLAG = 'flag',
  END = 'end',
}

/** The Rules step's own state: every number field is the text the seller typed. */
export interface ListingRulesDraft {
  veroProtectionEnabled: boolean;
  hideBrand: boolean;
  minPrice: string;
  maxPrice: string;
  amazonShippedOnly: boolean;
  primeOnly: boolean;
  pesticideProtection: boolean;
  minRating: string;
  minReviewCount: string;
  outOfStockEndDays: string;
  coldListingEnabled: boolean;
  coldListingDays: string;
  coldListingMode: ColdListingMode;
}

/** The first field of the Rules step that refuses its value. */
export enum ListingRulesDraftError {
  MIN_RATING = 'minRating',
  PRICE = 'price',
  COLD_DAYS = 'coldDays',
}

export interface ListingRulesOption {
  value: string;
  label: string;
}

/** The Rules step (presentational; its draft lives in the drawer container). */
export interface ListingRulesStepProps {
  draft: ListingRulesDraft;
  onChange: (changes: Partial<ListingRulesDraft>) => void;
  outOfStockOptions: ListingRulesOption[];
  coldListingModeOptions: ListingRulesOption[];
  minRatingError?: string;
  priceError?: string;
  coldListingDaysError?: string;
}

export interface ListingGroupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** null/undefined = create mode; string = edit existing group */
  editingGroupId?: string | null;
}

export interface ListingGroupDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: ListingGroupDrawerStep;
  onStepChange: (step: ListingGroupDrawerStep) => void;
  isEdit: boolean;
  isLoading: boolean;
  isSaving: boolean;
  form: UseFormReturn<ListingSettingsGroupFormData>;
  fields: FieldArrayWithId<ListingSettingsGroupFormData, 'repricingStrategy', 'id'>[];
  append: UseFieldArrayAppend<ListingSettingsGroupFormData, 'repricingStrategy'>;
  remove: UseFieldArrayRemove;
  onAddRange: () => void;
  isPriceRoundingEnabled: boolean;
  onPriceRoundingToggle: (enabled: boolean) => void;
  /** Already-localized worked example for the current ending ("$27.31 → $27.99"). */
  priceRoundingExample: string;
  templateOptions: Array<{ value: string; label: string }>;
  selectedTemplateValue: string;
  onTemplateChange: (value: string | number) => void;
  onEditTemplate: () => void;
  renderedPreview: string;
  onOpenPreview: () => void;
  onCustomTemplateRef: (node: HTMLTextAreaElement | null) => void;
  onCustomTemplateSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onInsertKeyword: (key: ListingTemplatePlaceholder) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  /** The Rules step (step 4 of 5). */
  rulesStep: ListingRulesStepProps;
}
