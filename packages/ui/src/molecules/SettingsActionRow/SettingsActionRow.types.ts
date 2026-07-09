import type { IconName } from '../../atoms/Icon';

export type SettingsActionRowVariant = 'default' | 'danger';

export interface SettingsActionRowProps {
  /** Icon shown to the left of the label. */
  icon: IconName;
  /** Row label. */
  label: string;
  /** Click handler — the whole row is a button. */
  onClick: () => void;
  /** `danger` renders icon/label/chevron in the error color (e.g. deactivate). */
  variant?: SettingsActionRowVariant;
  /** Overrides the auto-generated aria-label (defaults to the label). */
  ariaLabel?: string;
}
