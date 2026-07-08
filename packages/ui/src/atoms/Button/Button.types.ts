import { ButtonHTMLAttributes, ReactNode } from 'react';

import { IconName } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text' | 'danger';

export type ButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  // NOTE: iconLeft/iconRight/iconColor kept despite Task 1 brief requesting removal.
  // Brief claimed these were unused, but 8 feature files pass iconLeft to <Button>.
  // Removal requires a follow-up task to clean up feature code first.
  iconLeft?: IconName;
  iconRight?: IconName;
  iconColor?: string;
  children?: ReactNode;
  /** @deprecated Use iconOnly for square icon buttons */
  fullWidth?: boolean;
  /** Square icon-only button with fixed width matching height */
  iconOnly?: boolean;
}
