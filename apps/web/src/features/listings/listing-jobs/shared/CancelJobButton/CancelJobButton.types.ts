import type React from 'react';

export interface CancelJobButtonProps {
  /** The action's name, shown on the tooltip and read by screen readers. */
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}
