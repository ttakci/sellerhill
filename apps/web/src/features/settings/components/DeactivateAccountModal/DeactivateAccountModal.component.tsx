import { Dialog, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './DeactivateAccountModal.style';
import type { DeactivateAccountModalComponentProps } from './DeactivateAccountModal.types';

/**
 * Account deactivation prompt — uses shared Dialog molecule (same shell as MessageModal / ConfirmModal).
 */
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
  const isMatch = confirmInput.trim().toLowerCase() === userEmail.trim().toLowerCase();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      type="warning"
      typeTitles={{
        info: t('translation:dialog.title.info'),
        success: t('translation:dialog.title.success'),
        warning: t('translation:dialog.title.warning'),
        error: t('translation:dialog.title.error'),
      }}
      description={t('translation:settingsHub.modal.deactivate.warning')}
      primaryAction={{
        label: t('translation:settingsHub.modal.deactivate.confirmLabel'),
        onClick: onConfirm,
        variant: 'primary',
        isLoading,
        disabled: !isMatch || isLoading,
      }}
      secondaryAction={{
        label: t('translation:settingsHub.modal.deactivate.cancelLabel'),
        onClick: onClose,
        variant: 'secondary',
        disabled: isLoading,
      }}
    >
      <S.FieldBlock>
        <Text variant="body-sm" weight="medium" color="text.primary">
          {t('translation:settingsHub.modal.deactivate.typeEmail')}
        </Text>
        <ModernTextInput
          name="confirmText"
          label={t('translation:settingsHub.modal.deactivate.emailPlaceholder', { email: userEmail })}
          value={confirmInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfirmInputChange(e.target.value)}
          placeholder={userEmail}
        />
      </S.FieldBlock>
    </Dialog>
  );
};
