import { ButtonHTMLAttributes, ReactNode } from 'react';

/** `danger-tint` is the light-fill destructive action — same semantic tint
 *  Badge's error variant uses, for a "cancel/stop" action that shouldn't
 *  read as loud as a full delete (`danger`, solid fill). */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text' | 'danger' | 'danger-tint';

export type ButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children?: ReactNode;
  /** @deprecated Use iconOnly for square icon buttons */
  fullWidth?: boolean;
  /** Square icon-only button with fixed width matching height */
  iconOnly?: boolean;
}

export interface ActionSurfaceProps {
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth?: boolean;
  $isLoading?: boolean;
  $iconOnly?: boolean;
}
