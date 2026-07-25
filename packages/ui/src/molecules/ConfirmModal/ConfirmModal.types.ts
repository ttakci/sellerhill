import type { ReactNode } from 'react';

import type { MessageType } from '../../context';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /**
   * @deprecated Prefer type-based titles (omit this). Description already explains the action.
   * If set, overrides the type title.
   */
  title?: string;
  /** Localized short titles per type — used when `title` is omitted. */
  typeTitles?: Partial<Record<MessageType, string>>;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Drives the dialog icon + tint (info | success | warning | error).
   * Defaults to `warning` — confirmations are cautionary by nature.
   * @deprecated Use `type` instead. Kept for backward compat.
   */
  variant?: 'primary' | 'danger';
  /** Dialog semantic type — controls icon + icon disc color + default title. Defaults to `warning`. */
  type?: MessageType;
  isLoading?: boolean;
}
