import { getErrorMessage } from '@/utils/errorHandler';
import type { UpdateProfileFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfilePageComponent } from './ProfilePage.component';
import { useGetProfileQuery, useUpdateProfileMutation } from './api/profileApi';

export const ProfilePageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['profile', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const { data: profile, isLoading: isProfileLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating, isSuccess, error }] = useUpdateProfileMutation();

  useLoading(isProfileLoading || isUpdating);

  useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:common.success',
          descriptionKey: 'profile:profile.updateSuccess',
          primaryButton: {
            labelKey: 'translation:common.ok',
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
          headerKey: 'translation:common.error',
          descriptionKey: key, // getErrorMessage already handles namespace for some keys, but let's be careful
          descriptionParams: params,
          primaryButton: {
            labelKey: 'translation:common.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [error, showMessage, closeMessage, t]);

  const handleSubmit = (data: UpdateProfileFormData): void => {
    void updateProfile({
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber || undefined,
      avatarUrl: data.avatarUrl || undefined,
    });
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
