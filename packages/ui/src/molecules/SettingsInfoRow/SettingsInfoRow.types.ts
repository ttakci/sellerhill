import type { IconName } from '../../atoms/Icon';

export interface SettingsInfoRowProps {
  /** Optional glyph in a tinted disc before the label. Omit it on a plain fact row — the label column is ornament enough. */
  icon?: IconName;
  /** Row label (e.g. "Phone Number"). */
  label: string;
  /** Current value, right-aligned next to the edit action. */
  value: string;
  /** Shown instead of the edit action when the row cannot be edited. */
  onEdit?: () => void;
  /** Overrides the auto-generated aria-label for the edit button. */
  editAriaLabel?: string;
}
