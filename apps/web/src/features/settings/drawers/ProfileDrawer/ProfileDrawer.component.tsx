import { Drawer, ModernTextInput } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ProfileDrawer.style';
import type { ProfileDrawerComponentProps } from './ProfileDrawer.types';

export const ProfileDrawerComponent: React.FC<ProfileDrawerComponentProps> = ({
  isOpen,
  onClose,
  email,
  firstName,
  lastName,
  phoneNumber,
  isSaving,
  onFirstNameChange,
  onLastNameChange,
  onPhoneNumberChange,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.profile.title')}
      subtitle={t('translation:settingsHub.drawer.profile.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
      }}
    >
      <S.BodyStack>
        <S.FormCard>
          <ModernTextInput
            name="firstName"
            label={t('translation:settingsHub.drawer.profile.firstName')}
            value={firstName}
            onChange={onFirstNameChange}
          />
          <ModernTextInput
            name="lastName"
            label={t('translation:settingsHub.drawer.profile.lastName')}
            value={lastName}
            onChange={onLastNameChange}
          />
          <ModernTextInput
            name="email"
            label={t('translation:settingsHub.drawer.profile.email')}
            value={email}
            readOnly
          />
          <ModernTextInput
            name="phoneNumber"
            label={t('translation:settingsHub.drawer.profile.phone')}
            value={phoneNumber}
            onChange={onPhoneNumberChange}
          />
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

ProfileDrawerComponent.displayName = 'ProfileDrawerComponent';
