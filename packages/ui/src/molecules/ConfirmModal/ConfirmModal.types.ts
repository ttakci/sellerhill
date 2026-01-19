import type { ReactNode } from 'react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'primary' | 'danger';
  isLoading?: boolean;
}
