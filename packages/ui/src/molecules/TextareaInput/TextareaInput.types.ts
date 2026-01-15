import type { Control, FieldValues, Path } from 'react-hook-form';

export interface TextareaInputProps<TFieldValues extends FieldValues = FieldValues> {
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
   * Rows
   */
  rows?: number;

  /**
   * ID attribute
   */
  id?: string;
}
