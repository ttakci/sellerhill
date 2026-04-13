import { CreateListingsFormData } from '@repo/shared';

export interface AddListingsPageComponentProps {
  asins: string;
  asinCount: number;
  listingSettingsGroups: Array<{ id: string; name: string }>;
  businessPolicies: {
    payment: Array<{ id: string; name: string }>;
    shipping: Array<{ id: string; name: string }>;
    return: Array<{ id: string; name: string }>;
  };
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (data: CreateListingsFormData) => void;
  onAsinChange: (value: string) => void;
  onCancel: () => void;
}
