import type { Control } from 'react-hook-form';

export interface FormElementsFormValues {
  checkboxDefault: boolean;
  checkboxSelected: boolean;
  checkboxDisabled: boolean;
  radioDefault: string;
  radioSelected: string;
  radioDisabled: string;
  toggleDefault: boolean;
  toggleSelected: boolean;
  toggleDisabled: boolean;
  selectCountry: string;
  selectDisabled: string;
  textareaDefault: string;
  textareaDisabled: string;
  textDefault: string;
  textActive: string;
  textDisabled: string;
  textIconLeft: string;
  textIconRight: string;
  textPrefix: string;
  textSuffix: string;
}

export interface FormElementsPageProps {
  control: Control<FormElementsFormValues>;
}
