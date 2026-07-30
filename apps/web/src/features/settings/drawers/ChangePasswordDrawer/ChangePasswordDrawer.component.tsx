import { Drawer, ModernTextInput } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ChangePasswordDrawer.style';
import type { ChangePasswordDrawerComponentProps } from './ChangePasswordDrawer.types';

export const ChangePasswordDrawerComponent: React.FC<ChangePasswordDrawerComponentProps> = ({
  isOpen,
  onClose,
  currentPassword,
  newPassword,
  confirmPassword,
  error,
  isSaving,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.password.title')}
      subtitle={t('translation:settingsHub.drawer.password.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSubmit,
        isLoading: isSaving,
      }}
    >
      <S.BodyStack>
        <S.FormCard>
          <ModernTextInput
            name="currentPassword"
            label={t('translation:settingsHub.drawer.password.current')}
            value={currentPassword}
            type="password"
            onChange={onCurrentPasswordChange}
          />
          <ModernTextInput
            name="newPassword"
            label={t('translation:settingsHub.drawer.password.new')}
            value={newPassword}
            type="password"
            onChange={onNewPasswordChange}
          />
          <ModernTextInput
            name="confirmPassword"
            label={t('translation:settingsHub.drawer.password.confirm')}
            value={confirmPassword}
            type="password"
            onChange={onConfirmPasswordChange}
          />
          {error && (
            <S.ErrorText variant="caption" color="semantic.error">
              {error}
            </S.ErrorText>
          )}
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

ChangePasswordDrawerComponent.displayName = 'ChangePasswordDrawerComponent';
