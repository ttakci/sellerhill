import type { ListingSettingsGroupFormData, PredefinedTemplateResponse } from '@repo/shared';

export interface ListingSettingsGroupFormProps {
  defaultValues?: Partial<ListingSettingsGroupFormData>;
  predefinedTemplates: PredefinedTemplateResponse[];
  onSubmit: (data: ListingSettingsGroupFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
