import type { Control, FieldValues, Path } from 'react-hook-form';

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioGroupProps<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Field name
   */
  name: Path<TFieldValues>;

  /**
   * Control object
   */
  control: Control<TFieldValues>;

  /**
   * Group label
   */
  label?: string;

  /**
   * Options
   */
  options: RadioOption[];

  /**
   * Direction
   */
  direction?: 'horizontal' | 'vertical';

  /**
   * Required indicator
   */
  required?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;
}
