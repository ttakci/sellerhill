import type { Control, FieldValues, Path } from 'react-hook-form';

export interface CheckboxOption {
  label: string;
  value: string;
}

export interface CheckboxGroupProps<TFieldValues extends FieldValues = FieldValues> {
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
  options: CheckboxOption[];

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
