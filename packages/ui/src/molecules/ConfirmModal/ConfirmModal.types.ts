import type { ReactNode } from 'react';

import type { MessageType } from '../../context';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Drives the dialog icon + tint (info | success | warning | error).
   * Defaults to `warning` — confirmations are cautionary by nature.
   * @deprecated Use `type` instead. Kept for backward compat.
   */
  variant?: 'primary' | 'danger';
  /** Dialog semantic type — controls icon + icon disc color. Defaults to `warning`. */
  type?: MessageType;
  isLoading?: boolean;
}
