import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Drop the built-in bottom margin — use when the parent already provides
   * spacing (e.g. a flex container with `gap`), otherwise it doubles up. */
  noMargin?: boolean;
  /** Optional back action — rendered left of the title (mobile-friendly). */
  onBack?: () => void;
  backAriaLabel?: string;
  /** When true, back control is only shown below the tablet breakpoint. */
  backMobileOnly?: boolean;
}
