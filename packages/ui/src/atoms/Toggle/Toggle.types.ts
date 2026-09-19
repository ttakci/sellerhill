export interface ToggleProps {
  /**
   * Toggle checked state
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
   * Accessible name when there is no visible `label` (e.g. a switch in a
   * settings row whose title sits elsewhere). Without either, a screen reader
   * announces an unnamed switch.
   */
  ariaLabel?: string;

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
