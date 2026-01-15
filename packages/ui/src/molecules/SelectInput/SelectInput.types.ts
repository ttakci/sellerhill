import type { Control, FieldValues, Path } from 'react-hook-form';
import type { SelectOption } from '../../atoms/Select';

export interface SelectInputProps<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Field name
   */
  name: Path<TFieldValues>;

  /**
   * Control object from useForm
   */
  control: Control<TFieldValues>;

  /**
   * Label text
   */
  label?: string;

  /**
   * Options list
   */
  options: SelectOption[];

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Required indicator
   */
  required?: boolean;

  /**
   * Full width
   */
  fullWidth?: boolean;

  /**
   * ID attribute
   */
  id?: string;
}
