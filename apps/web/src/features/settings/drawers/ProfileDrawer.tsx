import type { UpdateProfileRequest } from '@repo/shared';
import { Drawer, ModernTextInput, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack } from './ProfileDrawer.style';
import type { ProfileDrawerProps } from './ProfileDrawer.types';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');

  const handleSave = (): void => {
    const payload: UpdateProfileRequest = {
      firstName,
      lastName,
      phoneNumber,
    };
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void updateProfile(payload)
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch(() => {
        showMessage({
          type: 'error',
          message: t('translation:common.error'),
        });
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.profile.title')}
      subtitle={t('translation:settingsHub.drawer.profile.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: handleSave,
        isLoading: !!isLoading,
      }}
    >
      <BodyStack>
        <ModernTextInput
          label={t('translation:settingsHub.drawer.profile.firstName')}
          value={firstName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFirstName(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.profile.lastName')}
          value={lastName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setLastName(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.profile.email')}
          value={profile?.email ?? ''}
          readOnly
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.profile.phone')}
          value={phoneNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPhoneNumber(e.target.value)
          }
        />
      </BodyStack>
    </Drawer>
  );
};
