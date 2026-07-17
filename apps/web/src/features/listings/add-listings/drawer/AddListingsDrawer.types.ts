import type { CreateListingsFormData } from '@repo/shared';
import type { UseFormReturn } from 'react-hook-form';

export type AddListingsDrawerStep = 0 | 1;

export interface AddListingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful queue; `asDraft` reflects the submitted mode. */
  onSuccess: (result?: { asDraft: boolean }) => void;
}

export interface AddListingsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: AddListingsDrawerStep;
  isSubmitting: boolean;
  isLoading: boolean;
  form: UseFormReturn<CreateListingsFormData>;
  listingSettingsGroups: Array<{ id: string; name: string }>;
  businessPolicies: {
    payment: Array<{ id: string; name: string }>;
    shipping: Array<{ id: string; name: string }>;
    return: Array<{ id: string; name: string }>;
  };
  asinCount: number;
  onAsinChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  canProceed: boolean;
}
