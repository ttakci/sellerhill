export interface RadioProps {
  /**
   * Radio selected state
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
   * Value for the radio group
   */
  value?: string;

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
