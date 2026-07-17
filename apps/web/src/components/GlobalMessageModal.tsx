import { MessageModal, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const GlobalMessageModal: React.FC = () => {
  const { messageState, closeMessage } = useUI();
  const { t } = useTranslation('translation');

  return (
    <MessageModal
      isOpen={messageState.isOpen}
      onClose={closeMessage}
      type={messageState.type}
      title={messageState.header}
      description={messageState.description}
      primaryButton={
        messageState.primaryButton || {
          label: t('common.ok'),
          onClick: closeMessage,
          // Always brand primary — Dialog never uses red action buttons
          variant: 'primary',
        }
      }
      secondaryButton={messageState.secondaryButton || undefined}
    />
  );
};
