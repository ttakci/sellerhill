import type { KeyboardEvent, ReactNode } from 'react';

export interface CopyableTextProps {
  /** The raw text copied to the clipboard on click. */
  value: string;
  /** Tooltip shown on hover/focus, e.g. "Copy street". Already localized. */
  label: string;
  /** Tooltip shown briefly after a successful copy, e.g. "Copied". Already localized. */
  copiedLabel: string;
  /** What to render as the visible text; defaults to `value`. */
  children?: ReactNode;
  className?: string;
}

export interface CopyableTextComponentProps extends CopyableTextProps {
  isCopied: boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => void;
}
