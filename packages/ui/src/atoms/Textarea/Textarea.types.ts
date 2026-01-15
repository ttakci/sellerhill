export interface TextareaProps {
  /**
   * Textarea value
   */
  value?: string;

  /**
   * Change handler
   */
  onChange?: (value: string) => void | ((event: React.ChangeEvent<HTMLTextAreaElement>) => void);

  /**
   * Blur handler
   */
  onBlur?: () => void | ((event: React.FocusEvent<HTMLTextAreaElement>) => void);

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
   * Number of rows
   */
  rows?: number;

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
