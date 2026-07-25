import { MessageModal, useUI, type MessageType } from '@repo/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Global alert host. Title is always the dialog type label (Uyarı / Bilgi / …);
 * description carries the actual message body from showMessage().
 */
export const GlobalMessageModal: React.FC = () => {
  const { messageState, closeMessage } = useUI();
  const { t } = useTranslation('translation');

  const typeTitles = useMemo(
    () =>
      ({
        info: t('dialog.title.info'),
        success: t('dialog.title.success'),
        warning: t('dialog.title.warning'),
        error: t('dialog.title.error'),
      }) satisfies Record<MessageType, string>,
    [t],
  );

  return (
    <MessageModal
      isOpen={messageState.isOpen}
      onClose={closeMessage}
      type={messageState.type}
      typeTitles={typeTitles}
      description={messageState.description}
      primaryButton={
        messageState.primaryButton || {
          label: t('common.ok'),
          onClick: closeMessage,
          variant: 'primary',
        }
      }
      secondaryButton={messageState.secondaryButton || undefined}
    />
  );
};
