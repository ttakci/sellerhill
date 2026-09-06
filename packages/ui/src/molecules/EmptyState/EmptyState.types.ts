import type { IconName } from '../../atoms/Icon';
import type { MessageType } from '../../context';

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
  /** Shows a spinner on the primary action button and disables it (e.g. while an async action is in flight) */
  isActionLoading?: boolean;
  /** Label for optional secondary action (e.g. clear filters) */
  secondaryAction?: string;
  /** Click handler for the secondary action */
  onSecondaryAction?: () => void;
  /** Size variant controlling icon and spacing scale */
  size?: EmptyStateSize;
  /**
   * Renders this empty state in the format `Dialog` (and therefore
   * `MessageModal`) uses for a message popup: a solid semantic disc with a
   * large white glyph, a 23px brand-coloured headline and `body` copy — instead
   * of the default pale brand-tinted disc, 15px card title and 13px caption.
   *
   * Set it on failure surfaces so a crash screen and an error popup read as the
   * same thing. It is deliberately ONE prop rather than three: matching only the
   * disc left the mark right and the type scale wrong, which is how the error
   * boundary ended up looking like a quiet empty list.
   */
  iconTone?: MessageType;
  /** Additional CSS class */
  className?: string;
}
