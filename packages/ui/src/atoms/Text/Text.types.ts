import type { ReactElement, ReactNode } from 'react';

export type TextVariant = 'body' | 'caption' | 'overline';

export type TextWeight = 'regular' | 'medium' | 'semibold';

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
}

export type TextElement = ReactElement;
