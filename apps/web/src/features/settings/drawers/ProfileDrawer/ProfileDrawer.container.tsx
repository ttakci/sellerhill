import type { UpdateProfileRequest } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProfileDrawerComponent } from './ProfileDrawer.component';
import type { ProfileDrawerProps } from './ProfileDrawer.types';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose, profile }) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');

  const handleSave = useCallback((): void => {
    const payload: UpdateProfileRequest = { firstName, lastName, phoneNumber };
    void updateProfile(payload)
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch(() => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:common.error',
            descriptionKey: 'translation:common.error',
          },
          t
        );
      });
  }, [firstName, lastName, phoneNumber, updateProfile, onClose, showMessage, t]);

  return (
    <ProfileDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      email={profile?.email ?? ''}
      firstName={firstName}
      lastName={lastName}
      phoneNumber={phoneNumber}
      isSaving={isLoading}
      onFirstNameChange={(e) => setFirstName(e.target.value)}
      onLastNameChange={(e) => setLastName(e.target.value)}
      onPhoneNumberChange={(e) => setPhoneNumber(e.target.value)}
      onSave={handleSave}
    />
  );
};

ProfileDrawer.displayName = 'ProfileDrawer';
