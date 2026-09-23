import type { ListingSettingsGroupFormData, ListingTemplatePlaceholder } from '@repo/shared';
import type React from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form';

export type ListingGroupDrawerStep = 0 | 1 | 2 | 3;

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
  canProceed: boolean;
}
