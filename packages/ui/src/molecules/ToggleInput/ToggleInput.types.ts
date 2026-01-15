import type { Control, FieldValues, Path } from 'react-hook-form';

export interface ToggleInputProps<TFieldValues extends FieldValues = FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}
