import type { IconName } from '../../atoms/Icon';

export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateProps {
  /** Icon name from the Icon component registry */
  icon?: IconName;
  /** Title text displayed below the icon */
  title: string;
  /** Description text displayed below the title */
  description: string;
  /** Label for the optional primary action button */
  action?: string;
  /** Click handler for the primary action */
  onAction?: () => void;
  /** Label for optional secondary action (e.g. clear filters) */
  secondaryAction?: string;
  /** Click handler for the secondary action */
  onSecondaryAction?: () => void;
  /** Size variant controlling icon and spacing scale */
  size?: EmptyStateSize;
  /** Additional CSS class */
  className?: string;
}
