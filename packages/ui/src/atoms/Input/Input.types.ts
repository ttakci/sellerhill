export type InputSize = 'sm' | 'md' | 'lg';

export type InputVariant = 'default' | 'error' | 'success';

/**
 * Platform-agnostic Input props
 * Works for both web and mobile
 */
export interface InputProps {
  /**
   * Input value
   */
  value?: string;

  /**
   * Change handler
   */
  onChange?: (value: string) => void;

  /**
   * Blur handler
   */
  onBlur?: () => void;

  /**
   * Focus handler
   */
  onFocus?: () => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Input size
   */
  size?: InputSize;

  /**
   * Input visual state
   */
  variant?: InputVariant;

  /**
   * Error message
   */
  error?: string;

  /**
   * Success message
   */
  success?: string;

  /**
   * Should display as full width
   */
  fullWidth?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Read-only state
   */
  readOnly?: boolean;

  /**
   * Input type (text, password, email, etc.)
   */
  type?: string;

  /**
   * Name attribute
   */
  name?: string;

  /**
   * ID attribute
   */
  id?: string;

  /**
   * Auto-focus
   */
  autoFocus?: boolean;

  /**
   * Max length
   */
  maxLength?: number;
}
