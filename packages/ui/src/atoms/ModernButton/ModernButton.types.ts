import { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconName } from '../Icon';

export type ModernButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text' | 'danger';
export type ModernButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

export interface ModernButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ModernButtonVariant;
  size?: ModernButtonSize;
  isLoading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  iconColor?: string;
  children?: ReactNode;
  fullWidth?: boolean;
}
