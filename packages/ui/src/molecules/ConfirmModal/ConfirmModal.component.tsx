import React from 'react';

import { Dialog } from '../Dialog';

import type { ConfirmModalProps } from './ConfirmModal.types';

/**
 * Thin wrapper over Dialog for confirm / cancel flows.
 * Always brand-blue buttons (Dialog coerces danger → primary).
 * Stack: outline cancel on top, filled confirm below.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  isLoading = false,
}) => {
  // `variant` only affects icon tone; Dialog always renders brand-blue buttons
  const dialogType = variant === 'danger' ? 'warning' : 'info';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      type={dialogType}
      title={title}
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
