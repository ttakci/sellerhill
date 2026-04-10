export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error';

export type ProgressBarSize = 'sm' | 'md';

export interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Color variant */
  variant?: ProgressBarVariant;
  /** Height size */
  size?: ProgressBarSize;
  /** Whether to show the percentage label */
  showLabel?: boolean;
  /** Accessible label describing what the progress bar represents */
  label?: string;
  className?: string;
}
