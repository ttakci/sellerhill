import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Platform-agnostic Button props
 * Works for both web and mobile
 */
export interface ButtonProps {
  /**
   * Button content
   */
  children: ReactNode;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Button visual variant
   */
  variant?: ButtonVariant;

  /**
   * Button size
   */
  size?: ButtonSize;

  /**
   * Should display as full width
   */
  fullWidth?: boolean;

  /**
   * Loading state
   */
  isLoading?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Button type (button, submit, reset)
   */
  type?: 'button' | 'submit' | 'reset';
}
