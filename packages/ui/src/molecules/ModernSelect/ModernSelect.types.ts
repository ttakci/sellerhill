import { Control, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { IconName } from '../../atoms/Icon';

export interface SelectOption {
  label: string;
  value: string | number;
  icon?: IconName;
}

export type ModernSelectSize = 'small' | 'medium' | 'large';

export interface ModernSelectProps<TFieldValues extends FieldValues = FieldValues> {
  name?: Path<TFieldValues>;
  control?: Control<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  label?: string; // Made optional for cases like pagination
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  placeholder?: string;
  iconLeft?: IconName;
  isDisabled?: boolean;
  fullWidth?: boolean;
  isSearchable?: boolean;
  id?: string;
  error?: { message?: string };
  size?: ModernSelectSize;
  searchPlaceholder?: string;
  noResultsMessage?: string;
}
