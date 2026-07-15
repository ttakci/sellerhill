import type { FieldError, FieldValues, UseControllerProps } from 'react-hook-form';

import { IconName } from '../../atoms/Icon';

export interface InnerFieldProps {
  name: string;
  value: string;
  onChange: (...event: unknown[]) => void;
  onBlur: () => void;
}

export type TextInputSize = 'small' | 'medium' | 'large';

export interface TextInputInnerComponentProps {
  field: InnerFieldProps;
  error?: FieldError;
  label?: string;
  iconLeft?: IconName;
  iconRight?: IconName;
  isDisabled?: boolean;
  fullWidth?: boolean;
  type?: string;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  autoComplete?: string;
  onPressIcon?: () => void;
  size?: TextInputSize;
  suffixText?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // State from container
  isFocused: boolean;
  isPasswordVisible: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  /** @deprecated computed internally from field.value — do not pass */
  hasValue?: boolean;
  effectiveType: string;
  effectiveIconRight?: IconName;
  isPassword: boolean;
  // Handlers from container
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlurField: () => void;
  onContainerClick: () => void;
  onTogglePasswordVisibility: () => void;
}

export interface TextInputProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<Partial<UseControllerProps<TFieldValues>>, 'name'> {
  name: string;
  label?: string;
  placeholder?: string;
  type?: string;
  isDisabled?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  suffixText?: string;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: string;
  onPressIcon?: () => void;
  size?: TextInputSize;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  required?: boolean;
  readOnly?: boolean;
}
