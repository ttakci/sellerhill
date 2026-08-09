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
  /**
   * When provided, renders a left-arrow back button to the left of the title
   * (for nested drawer flows). The Save action still uses `primaryAction`.
   */
  onBack?: () => void;
  backAriaLabel?: string;
  children: React.ReactNode;
  primaryAction?: DrawerPrimaryAction;
  footer?: React.ReactNode;
  /** @deprecated Drawers use one application-wide width. Kept for source compatibility; the value no longer changes the shell. */
  size?: DrawerSize;
  className?: string;
}

export interface DrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backAriaLabel?: string;
  children: React.ReactNode;
  primaryAction?: DrawerPrimaryAction;
  footer?: React.ReactNode;
  /** @deprecated Drawers use one application-wide width. Kept for source compatibility; the value no longer changes the shell. */
  size?: DrawerSize;
  className?: string;
}
