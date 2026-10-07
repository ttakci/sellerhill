export interface RadioProps {
  /** Selected state (controlled). */
  checked: boolean;
  /** Called with this radio's `value` when it gets selected. */
  onChange: (value: string) => void;
  /** The value this option stands for. */
  value: string;
  /** Group name — radios sharing it are one choice (arrow keys move between them). */
  name: string;
  /** Visible label (already translated). */
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}
