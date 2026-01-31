import { FieldValues, UseControllerProps } from 'react-hook-form';
import { IconName } from '../../atoms/Icon';

export type ModernTextInputSize = 'small' | 'medium' | 'large';

export interface ModernTextInputProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<Partial<UseControllerProps<TFieldValues>>, 'name'> {
  name: any;
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
  size?: ModernTextInputSize;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}
