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
  /**
   * Floating label, matching TextInput/Select: sits over the field when empty
   * and unfocused, animates to the top-left corner on focus or when a value is
   * present. Purely CSS-driven (`:focus` / `:placeholder-shown`), so the atom
   * stays stateless.
   */
  label?: string;
  /**
   * Grow with content instead of sizing to `rows`. Uses CSS `field-sizing:
   * content` bounded by `min-height` (floor) and `max-height` (then scrolls).
   * For a read-only preview that must expand as the text does.
   */
  autoResize?: boolean;
}
