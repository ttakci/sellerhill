import type { ListingSettingsGroupFormData, PredefinedTemplateResponse } from '@repo/shared';

export interface ListingSettingsGroupFormProps {
  isEdit?: boolean;
  defaultValues?: Partial<ListingSettingsGroupFormData>;
  predefinedTemplates: PredefinedTemplateResponse[];
  onSubmit: (data: ListingSettingsGroupFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}
