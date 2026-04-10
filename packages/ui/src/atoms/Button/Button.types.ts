import { ButtonHTMLAttributes, ReactNode } from 'react';
import { IconName } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'text' | 'danger';

export type ButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
  iconColor?: string;
  children?: ReactNode;
  fullWidth?: boolean;
}
