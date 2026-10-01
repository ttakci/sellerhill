export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'teal'
  | 'sky'
  | 'orange'
  | 'navy'
  /** Filled badges — ink on a solid fill, for the one or two states a screen must shout. */
  | 'solidNavy'
  | 'solidAmber';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  isPill?: boolean;
  className?: string;
}
