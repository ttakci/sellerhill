import type { ListingSettingsGroupFormData, PredefinedTemplateResponse } from '@repo/shared';
import { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form';

export interface ListingSettingsGroupFormProps {
  isEdit?: boolean;
  defaultValues?: Partial<ListingSettingsGroupFormData>;
  predefinedTemplates: PredefinedTemplateResponse[];
  onSubmit: (data: ListingSettingsGroupFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;

  // Form
  form: UseFormReturn<ListingSettingsGroupFormData>;
  fields: FieldArrayWithId<ListingSettingsGroupFormData, 'repricingStrategy', 'id'>[];
  append: UseFieldArrayAppend<ListingSettingsGroupFormData, 'repricingStrategy'>;
  remove: UseFieldArrayRemove;
  onAddRange: () => void;

  // Preview
  previewDevice: 'desktop' | 'tablet' | 'mobile';
  setPreviewDevice: (val: 'desktop' | 'tablet' | 'mobile') => void;
  renderedPreview: string;
  getPreviewWidth: () => string;
  activeTemplate: { htmlContent: string; sampleData: Record<string, string | string[]> };
  onOpenPreview: () => void;
}
