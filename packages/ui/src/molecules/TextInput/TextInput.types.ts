import type { Control, FieldValues, Path } from 'react-hook-form';
import type { IconName } from '../../atoms/Icon';

/**
 * TextInput Molecule Props
 * 
 * Controller-wrapped Input component with integrated Floating Label and Error display
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
   * Label text. Acting as placeholder when empty, and floating label when focused/filled.
   */
  label: string;

  /**
   * Input type
   */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search' | 'number';

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Input size
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Should display as full width
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

  /**
   * Left icon name
   */
  leftIcon?: IconName;

  /**
   * Right icon name
   */
  rightIcon?: IconName;

  /**
   * Prefix text/element
   */
  prefix?: React.ReactNode;

  /**
   * Suffix text/element
   */
  suffix?: React.ReactNode;
}
