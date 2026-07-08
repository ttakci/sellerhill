import type React from 'react';

export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: DrawerSize;
  className?: string;
}

export interface DrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: DrawerSize;
  className?: string;
}
