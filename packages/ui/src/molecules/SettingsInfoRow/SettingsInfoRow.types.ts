import type { IconName } from '../../atoms/Icon';

export interface SettingsInfoRowProps {
  /** Icon shown inside the tinted circle to the left of the label. */
  icon: IconName;
  /** Row label (e.g. "Phone Number"). */
  label: string;
  /** Current value, right-aligned next to the edit action. */
  value: string;
  /** Shown instead of the edit action when the row cannot be edited. */
  onEdit?: () => void;
  /** Overrides the auto-generated aria-label for the edit button. */
  editAriaLabel?: string;
}
