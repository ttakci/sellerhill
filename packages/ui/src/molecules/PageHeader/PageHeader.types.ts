import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Drop the built-in bottom margin — use when the parent already provides
   * spacing (e.g. a flex container with `gap`), otherwise it doubles up. */
  noMargin?: boolean;
}
