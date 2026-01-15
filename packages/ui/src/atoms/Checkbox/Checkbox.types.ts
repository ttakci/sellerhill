export interface CheckboxProps {
  /**
   * Checkbox checked state
   */
  checked?: boolean;

  /**
   * Default checked state (uncontrolled)
   */
  defaultChecked?: boolean;

  /**
   * Change handler
   */
  onChange?: (checked: boolean) => void;

  /**
   * Label text
   */
  label?: string;

  /**
   * Disabled state
   */
  disabled?: boolean;

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
