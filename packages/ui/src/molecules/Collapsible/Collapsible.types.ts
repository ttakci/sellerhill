import type React from 'react';

export interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  onChange?: (open: boolean) => void;
  className?: string;
}

export interface CollapsibleComponentProps {
  title: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  isOpen: boolean;
  maxHeight: number | null;
  contentRef: React.RefObject<HTMLDivElement>;
  onToggle: () => void;
}
