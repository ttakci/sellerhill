import type { UpdateProfileRequest } from '@repo/shared';
import { isValidPhone, useUI, type CountryCode } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { ProfileDrawerComponent } from './ProfileDrawer.component';
import type { ProfileDrawerProps } from './ProfileDrawer.types';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';
import { getTimezoneOptions } from '@/features/profile/utils/timezoneOptions';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ isOpen, onClose, profile }) => {
  const { t, i18n } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? '');
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
      setTimezone(profile?.timezone ?? '');
      setSubmitAttempted(false);
    }
  }
  const timezoneOptions = useMemo(() => getTimezoneOptions(profile?.timezone), [profile?.timezone]);

  // Optional field: empty saves fine; a non-empty value must be a real number.
  const phoneInvalid = phoneNumber !== '' && !isValidPhone(phoneNumber);
  const phoneError =
    submitAttempted && phoneInvalid
      ? t('translation:settingsHub.drawer.profile.phoneInvalid')
      : undefined;

  const handleTimezoneChange = useCallback((value: string | number): void => setTimezone(String(value)), []);

  const handleSave = useCallback((): void => {
    if (phoneNumber !== '' && !isValidPhone(phoneNumber)) {
      setSubmitAttempted(true);
      return;
    }
    const payload: UpdateProfileRequest = {
      firstName,
      lastName,
      phoneNumber,
      ...(timezone ? { timezone } : {}),
    };
    void updateProfile(payload)
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
      })
      .catch((err: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:common.error',
            // The API's own key (e.g. an unknown time zone), else the generic error.
            descriptionKey: getErrorI18nKey(err as Parameters<typeof getErrorI18nKey>[0]),
          },
          t
        );
      });
  }, [firstName, lastName, phoneNumber, timezone, updateProfile, onClose, showMessage, closeMessage, t]);

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
      timezone={timezone}
      timezoneOptions={timezoneOptions}
      onTimezoneChange={handleTimezoneChange}
      onFirstNameChange={(e) => setFirstName(e.target.value)}
      onLastNameChange={(e) => setLastName(e.target.value)}
      onPhoneNumberChange={(value) => setPhoneNumber(value)}
      onSave={handleSave}
    />
  );
};

ProfileDrawer.displayName = 'ProfileDrawer';
