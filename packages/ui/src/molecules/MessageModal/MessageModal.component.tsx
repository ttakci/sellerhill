import React from 'react';

import { Dialog } from '../Dialog';

import type { MessageModalProps } from './MessageModal.types';

/**
 * Thin wrapper over Dialog for global showMessage alerts.
 */
export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  description,
  primaryButton,
  secondaryButton,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      type={type}
      title={title}
      description={description}
      primaryAction={{
        label: primaryButton.label,
        onClick: () => {
          primaryButton.onClick();
          onClose();
        },
        variant: primaryButton.variant,
      }}
      secondaryAction={
        secondaryButton
          ? {
              label: secondaryButton.label,
              onClick: () => {
                secondaryButton.onClick();
                onClose();
              },
              variant: secondaryButton.variant ?? 'secondary',
            }
          : undefined
      }
    />
  );
};

MessageModal.displayName = 'MessageModal';
