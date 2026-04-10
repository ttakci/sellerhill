import React from 'react';

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  position?: PopoverPosition;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}
