import { Button, Icon, Modal, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './DeactivateAccountModal.style';
import type { DeactivateAccountModalComponentProps } from './DeactivateAccountModal.types';

export const DeactivateAccountModalComponent = ({
  isOpen,
  onClose,
  userEmail,
  confirmInput,
  onConfirmInputChange,
  onConfirm,
  isLoading,
}: DeactivateAccountModalComponentProps): React.ReactElement => {
  const { t } = useTranslation();
  const isMatch =
    confirmInput.trim().toLowerCase() === userEmail.trim().toLowerCase();

  const footer = (
    <S.FooterRow>
      <Button variant="text" onClick={onClose} disabled={isLoading}>
        <Text>{t('translation:settingsHub.modal.deactivate.cancelLabel')}</Text>
      </Button>
      <Button variant="danger" onClick={onConfirm} isLoading={isLoading} disabled={!isMatch}>
        <Text>{t('translation:settingsHub.modal.deactivate.confirmLabel')}</Text>
      </Button>
    </S.FooterRow>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.modal.deactivate.title')}
      size="sm"
      footer={footer}
    >
      <S.BodyStack>
        <S.WarningBlock>
          <Icon name="alert-triangle" color="semantic.error" size={20} />
          <Text variant="body-sm" color="text.secondary">
            {t('translation:settingsHub.modal.deactivate.warning')}
          </Text>
        </S.WarningBlock>
        <Text variant="body-sm" weight="medium">
          {t('translation:settingsHub.modal.deactivate.typeEmail')}
        </Text>
        <ModernTextInput
          name="confirmText"
          label={t('translation:settingsHub.modal.deactivate.emailPlaceholder', { email: userEmail })}
          value={confirmInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfirmInputChange(e.target.value)}
          placeholder={userEmail}
        />
      </S.BodyStack>
    </Modal>
  );
};
