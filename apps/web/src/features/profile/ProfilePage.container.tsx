import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useGetProfileQuery, useUpdateProfileMutation } from './api/profileApi';
import { ProfilePageComponent } from './ProfilePage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';

export const ProfilePageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['profile', 'translation']);
  const { showMessage, closeMessage } = useUI();
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);

  const { data: profile, isLoading: isProfileLoading } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating, isSuccess, error }] = useUpdateProfileMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema(t)),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      avatarUrl: '',
      jobTitle: '',
      bio: '',
      country: '',
      cityState: '',
      postalCode: '',
    },
  });

  /* useLoading is for BLOCKING MUTATIONS only. The initial query flags used
     to be folded in here, so the global overlay covered the whole app on
     first paint of this page instead of the page showing its own state. */
  useLoading(isUpdating);

  // Sync profile data to form when loaded
  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phoneNumber: profile.phoneNumber || '',
        avatarUrl: profile.avatarUrl || '',
        jobTitle: profile.jobTitle || '',
        bio: profile.bio || '', // Removed hardcoded fallback per previous decision
        country: profile.country || '',
        cityState: profile.cityState || '',
        postalCode: profile.postalCode || '',
      });
    }
  }, [profile, reset]);

  const handleSuccessClose = useCallback(() => {
    closeMessage();
    setIsEditing(false);
  }, [closeMessage]);

  useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:common.success',
          descriptionKey: 'profile:profile.updateSuccess',
          primaryButton: {
            labelKey: 'translation:common.ok',
            onClick: handleSuccessClose,
          },
        },
        t
      );
    }
  }, [isSuccess, showMessage, handleSuccessClose, t]);

  useEffect(() => {
    if (!error) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t
    );
  }, [error, showMessage, closeMessage, t]);

  const onFormSubmit = (data: UpdateProfileFormData): void => {
    void updateProfile({
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber || undefined,
      avatarUrl: data.avatarUrl || undefined,
      jobTitle: data.jobTitle || undefined,
      bio: data.bio || undefined,
      country: data.country || undefined,
      cityState: data.cityState || undefined,
      postalCode: data.postalCode || undefined,
    });
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    // Optional: Reset form to last saved profile when cancelling edit?
    // if (!isEditing && profile) reset(...) 
    // Usually user expects 'Cancel' to revert.
    if (isEditing && profile) { // If we ARE editing and toggle off (Cancel)
         reset({
            firstName: profile.firstName,
            lastName: profile.lastName,
            phoneNumber: profile.phoneNumber || '',
            avatarUrl: profile.avatarUrl || '',
            jobTitle: profile.jobTitle || '',
            bio: profile.bio || '',
            country: profile.country || '',
            cityState: profile.cityState || '',
            postalCode: profile.postalCode || '',
         });
    }
  };

  if (isProfileLoading || !profile) {
    return <div />; 
  }

  return (
    <ProfilePageComponent
      profile={profile}
      control={control}
      errors={errors}
      onSubmit={handleSubmit(onFormSubmit)}
      isLoading={isUpdating}
      isEditing={isEditing}
      onToggleEdit={handleToggleEdit}
    />
  );
};
