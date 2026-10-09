import { ButtonHTMLAttributes, ReactNode } from 'react';

/** `danger-tint` is the light-fill destructive action — same semantic tint
 *  Badge's error variant uses, for a "cancel/stop" action that shouldn't
 *  read as loud as a full delete (`danger`, solid fill). */
/** `teal` is a solid teal fill — a second solid action beside a `primary`
 *  one, so two actions side by side do not read as the same button. */
/** `success`, `teal` and `orange` are further solid fills, for a row of
 *  actions where each one should be told apart by colour (the order detail). */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'text'
  | 'danger'
  | 'danger-tint'
  | 'navy'
  | 'success'
  | 'teal'
  | 'orange';

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
