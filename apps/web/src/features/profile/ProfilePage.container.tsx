import { getErrorMessage } from '@/utils/errorHandler';
import type { UpdateProfileFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfilePageComponent } from './ProfilePage.component';
import { useGetProfileQuery, useUpdateProfileMutation } from './api/profileApi';

export const ProfilePageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();

  const { data: profile, isLoading: isProfileLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating, isSuccess, error }] = useUpdateProfileMutation();

  useLoading(isProfileLoading || isUpdating);

  useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'common.success',
          descriptionKey: 'profile.updateSuccess',
          primaryButton: {
            labelKey: 'common.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [isSuccess, showMessage, closeMessage, t]);

  useEffect(() => {
    if (error) {
      const { key, params } = getErrorMessage(error);
      showMessage(
        {
          type: 'error',
          headerKey: 'common.error',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'common.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [error, showMessage, closeMessage, t]);

  const handleSubmit = async (data: UpdateProfileFormData): Promise<void> => {
    try {
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber || undefined,
        avatarUrl: data.avatarUrl || undefined,
      }).unwrap();
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  if (isProfileLoading || !profile) {
    return <div />; 
  }

  return (
    <ProfilePageComponent
      profile={profile}
      onSubmit={handleSubmit}
      isLoading={isUpdating}
    />
  );
};
