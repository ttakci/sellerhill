import type { ReactNode } from 'react';

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverProps {
  trigger: ReactNode;
  content: ReactNode;
  position?: PopoverPosition;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
}
