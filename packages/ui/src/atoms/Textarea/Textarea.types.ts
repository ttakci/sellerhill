import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  rows?: number;
  fullWidth?: boolean;
  /**
   * Fill the nearest positioned ancestor (`position: absolute; inset: 0`) instead
   * of sizing to `rows`. For a textarea that must occupy the remaining height of
   * a card. Two features had forked their own native `<textarea>` for exactly
   * this, each re-implementing the border/focus treatment.
   */
  fill?: boolean;
  /** Monospace + relaxed line-height, for HTML/code content. */
  mono?: boolean;
}
