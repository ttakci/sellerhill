import type { ReactElement, ReactNode } from 'react';

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'body' | 'body-sm' | 'body-xs' | 'caption' | 'overline' | 'mono' | 'metric' | 'metric-sm' | 'nav';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextAlign = 'left' | 'center' | 'right';


/**
 * Platform-agnostic Text props
 * Works for both web and mobile
 */
export interface TextProps {
  /**
   * Text content
   */
  children: ReactNode;


  /**
   * Text variant (font-size and line-height control)
   */
  variant?: TextVariant;

  /**
   * Font weight
   */
  weight?: TextWeight;

  /**
   * Text alignment
   */
  align?: TextAlign;

  /**
   * Color tone
   */
  muted?: boolean;

  /**
   * Show in single line and truncate overflow with ...
   */
  truncate?: boolean;

  /**
   * Lining, fixed-width numerals. Required for any figure rendered in a column
   * (money, counts, percentages) so digits stack instead of jittering.
   * `metric` / `metric-sm` already enable this.
   */
  numeric?: boolean;

  /**
   * Text color (semantic path)
   */
  color?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: React.CSSProperties;
}

export type TextElement = ReactElement;
