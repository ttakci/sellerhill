export type ProgressRingVariant = 'default' | 'success' | 'warning' | 'error';

export type ProgressRingSize = 'sm' | 'md' | 'lg';

export interface ProgressRingProps {
  /** Progress value from 0 to 100. Clamped. */
  value: number;
  /** Color variant. Mirrors ProgressBar's so a screen can switch shape without
   *  re-deciding what "over limit" looks like. */
  variant?: ProgressRingVariant;
  size?: ProgressRingSize;
  /**
   * Text rendered inside the ring. A caller-supplied string rather than a
   * derived percentage: a quota reads better as "50/50" than as "100%", and the
   * ring already carries the proportion visually.
   */
  centerLabel?: string;
  /** Accessible description of what the ring represents. */
  label?: string;
  className?: string;
}
