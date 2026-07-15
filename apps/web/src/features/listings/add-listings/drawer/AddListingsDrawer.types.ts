import type { CreateListingsFormData } from '@repo/shared';
import type { UseFormReturn } from 'react-hook-form';

export type AddListingsDrawerStep = 0 | 1;

export interface AddListingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface AddListingsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: AddListingsDrawerStep;
  onStepChange: (step: AddListingsDrawerStep) => void;
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
