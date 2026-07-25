import React from 'react';

import { Dialog } from '../Dialog';

import type { MessageModalProps } from './MessageModal.types';

/**
 * Thin wrapper over Dialog for global showMessage alerts.
 * Title is driven by `type` (Uyarı / Bilgi / Hata / Başarılı); description carries the message.
 */
export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  typeTitles,
  description,
  primaryButton,
  secondaryButton,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      type={type}
      // Omit empty title so Dialog falls back to typeTitles / defaults
      title={title?.trim() ? title : undefined}
      typeTitles={typeTitles}
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
