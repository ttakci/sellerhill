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

  // The drawer stays mounted the whole time (visibility is just `isOpen`), so the
  // useState initializers above only ever ran once — often before the profile
  // query resolved, leaving the form permanently empty. Resync from the latest
  // profile every time the drawer opens (React-recommended render-time state reset).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFirstName(profile?.firstName ?? '');
      setLastName(profile?.lastName ?? '');
      setPhoneNumber(profile?.phoneNumber ?? '');
    }
  }

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
