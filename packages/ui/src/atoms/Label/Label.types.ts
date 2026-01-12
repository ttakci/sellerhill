import type { ReactNode } from 'react';

export type LabelSize = 'sm' | 'md' | 'lg';

/**
 * Platform-agnostic Label props
 * Works for both web and mobile
 */
export interface LabelProps {
  /**
   * Label content
   */
  children: ReactNode;

  /**
   * Label size
   */
  size?: LabelSize;

  /**
   * Required field indicator
   */
  required?: boolean;

  /**
   * Disabled appearance
   */
  disabled?: boolean;
}
