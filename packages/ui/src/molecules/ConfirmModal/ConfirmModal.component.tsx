import React from 'react';

import type { MessageType } from '../../context';
import { Dialog } from '../Dialog';

import type { ConfirmModalProps } from './ConfirmModal.types';

/**
 * Thin wrapper over Dialog for confirm / cancel flows.
 * Title is type-based (Uyarı / Bilgi / …) unless an explicit `title` override is passed.
 * Always brand-blue buttons. Stack: outline cancel on top, filled confirm below.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  typeTitles,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  type,
  isLoading = false,
}) => {
  const dialogType: MessageType =
    type ?? (variant === 'danger' ? 'warning' : variant === 'primary' ? 'info' : 'warning');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      type={dialogType}
      title={title?.trim() ? title : undefined}
      typeTitles={typeTitles}
      description={description}
      primaryAction={{
        label: confirmLabel,
        onClick: onConfirm,
        variant: 'primary',
        isLoading,
      }}
      secondaryAction={{
        label: cancelLabel,
        onClick: onClose,
        variant: 'secondary',
        disabled: isLoading,
      }}
    />
  );
};

ConfirmModal.displayName = 'ConfirmModal';
