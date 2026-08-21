import type React from 'react';

export interface InfoMessageProps {
  children: React.ReactNode;
  /** Label for an optional action button, e.g. "Fix payment". Same
   *  action/onAction/isActionLoading shape as EmptyState, so a hint that grows
   *  a call-to-action does not need a different API to learn. */
  action?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
  className?: string;
}
