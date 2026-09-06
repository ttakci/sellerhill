import { Drawer, ModernTextInput, PhoneInput } from '@repo/ui';
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
  phoneError,
  defaultCountry,
  isSaving,
  onFirstNameChange,
  onLastNameChange,
  onPhoneNumberChange,
  onSave,
}) => {
  const { t, i18n } = useTranslation();

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
          <PhoneInput
            name="phoneNumber"
            label={t('translation:settingsHub.drawer.profile.phone')}
            countryLabel={t('translation:settingsHub.drawer.profile.phoneCountry')}
            value={phoneNumber}
            onChange={onPhoneNumberChange}
            errorMessage={phoneError}
            defaultCountry={defaultCountry}
            locale={i18n.language}
            searchPlaceholder={t('translation:settingsHub.drawer.profile.phoneCountrySearch')}
            noResultsMessage={t('translation:common.noResults')}
          />
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

ProfileDrawerComponent.displayName = 'ProfileDrawerComponent';
