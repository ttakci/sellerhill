import type { UpdateProfileRequest } from '@repo/shared';
import { isValidPhone, useUI, type CountryCode } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { ProfileDrawerComponent } from './ProfileDrawer.component';
import type { ProfileDrawerProps } from './ProfileDrawer.types';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose, profile }) => {
  const { t, i18n } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const defaultCountry: CountryCode = i18n.language?.toLowerCase().startsWith('tr') ? 'TR' : 'US';

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
      setSubmitAttempted(false);
    }
  }

  // Optional field: empty saves fine; a non-empty value must be a real number.
  const phoneInvalid = phoneNumber !== '' && !isValidPhone(phoneNumber);
  const phoneError =
    submitAttempted && phoneInvalid
      ? t('translation:settingsHub.drawer.profile.phoneInvalid')
      : undefined;

  const handleSave = useCallback((): void => {
    if (phoneNumber !== '' && !isValidPhone(phoneNumber)) {
      setSubmitAttempted(true);
      return;
    }
    const payload: UpdateProfileRequest = { firstName, lastName, phoneNumber };
    void updateProfile(payload)
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
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
  }, [firstName, lastName, phoneNumber, updateProfile, onClose, showMessage, closeMessage, t]);

  return (
    <ProfileDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      email={profile?.email ?? ''}
      firstName={firstName}
      lastName={lastName}
      phoneNumber={phoneNumber}
      phoneError={phoneError}
      defaultCountry={defaultCountry}
      isSaving={isLoading}
      onFirstNameChange={(e) => setFirstName(e.target.value)}
      onLastNameChange={(e) => setLastName(e.target.value)}
      onPhoneNumberChange={(value) => setPhoneNumber(value)}
      onSave={handleSave}
    />
  );
};

ProfileDrawer.displayName = 'ProfileDrawer';
