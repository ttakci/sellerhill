export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  /**
   * Options list
   */
  options: SelectOption[];

  /**
   * Selected value
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
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Error state
   */
  hasError?: boolean;

  /**
   * Full width
   */
  fullWidth?: boolean;

  /**
   * Name attribute
   */
  name?: string;

  /**
   * ID attribute
   */
  id?: string;

  /**
   * Custom className
   */
  className?: string;
}
