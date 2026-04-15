import { FieldValues, UseControllerProps } from 'react-hook-form';

import { IconName } from '../../atoms/Icon';

export type TextInputSize = 'small' | 'medium' | 'large';

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
}
