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
   * Change handler (supports both React Hook Form and direct usage)
   */
  onChange?: ((value: string) => void) | ((event: React.ChangeEvent<HTMLInputElement>) => void);

  /**
   * Blur handler (supports both React Hook Form and direct usage)
   */
  onBlur?: (() => void) | ((event: React.FocusEvent<HTMLInputElement>) => void);

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
   * Boolean error state (for form validation)
   */
  hasError?: boolean;

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

  /**
   * Custom style
   */
  style?: React.CSSProperties;
}
