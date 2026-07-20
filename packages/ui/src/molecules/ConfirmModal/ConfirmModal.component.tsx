import React from 'react';

import type { MessageType } from '../../context';
import { Dialog } from '../Dialog';

import type { ConfirmModalProps } from './ConfirmModal.types';

/**
 * Thin wrapper over Dialog for confirm / cancel flows.
 * Always brand-blue buttons (Dialog coerces danger → primary).
 * Stack: outline cancel on top, filled confirm below.
 *
 * Icon + disc color come from `type` (default `warning` — confirmations are cautionary).
 * Legacy `variant: 'danger'` maps to `warning`; `variant: 'primary'` maps to `info`.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  type,
  isLoading = false,
}) => {
  // Resolve dialog type: explicit `type` wins; fall back to legacy `variant` mapping; default `warning`.
  const dialogType: MessageType =
    type ?? (variant === 'danger' ? 'warning' : variant === 'primary' ? 'info' : 'warning');

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
