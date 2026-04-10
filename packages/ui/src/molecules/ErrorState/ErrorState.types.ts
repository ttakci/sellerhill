export interface ErrorStateProps {
  /** Title text displayed below the error icon */
  title: string;
  /** Description text displayed below the title */
  description: string;
  /** Label for the optional primary action button */
  primaryAction?: string;
  /** Label for the optional secondary action button */
  secondaryAction?: string;
  /** Click handler for the primary action button */
  onPrimaryAction?: () => void;
  /** Click handler for the secondary action button */
  onSecondaryAction?: () => void;
  /** Additional CSS class */
  className?: string;
}
