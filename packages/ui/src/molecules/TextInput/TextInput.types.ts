import type { Control, FieldValues, Path } from 'react-hook-form';

/**
 * TextInput Molecule Props
 * 
 * Controller-wrapped Input component with integrated Label and Error display
 */
export interface TextInputProps<TFieldValues extends FieldValues = FieldValues> {
  /**
   * Field name (must match schema property)
   */
  name: Path<TFieldValues>;

  /**
   * React Hook Form control object
   */
  control: Control<TFieldValues>;

  /**
   * Label text (optional - if not provided, no label will be shown)
   */
  label?: string;

  /**
   * Input type
   */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search';

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Required indicator on label
   */
  required?: boolean;

  /**
   * Input size
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Full width
   */
  fullWidth?: boolean;

  /**
   * Auto focus
   */
  autoFocus?: boolean;

  /**
   * Max length
   */
  maxLength?: number;

  /**
   * ID attribute (for accessibility)
   */
  id?: string;
}
