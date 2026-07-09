import type React from 'react';

export type DrawerSize = 'sm' | 'md' | 'lg';

/**
 * Standardized primary action rendered as a single full-width, large primary
 * button in the Drawer footer. Use this instead of a custom `footer` so every
 * Drawer shares the same confirm-button treatment (no cancel button — the X
 * closes the drawer).
 */
export interface DrawerPrimaryAction {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryAction?: DrawerPrimaryAction;
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
  primaryAction?: DrawerPrimaryAction;
  footer?: React.ReactNode;
  size?: DrawerSize;
  className?: string;
}
