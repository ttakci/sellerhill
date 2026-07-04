import styled from '@emotion/styled';
import type { ProfileDto, UpdateProfileRequest } from '@repo/shared';
import {
  Button,
  Drawer,
  ModernTextInput,
  Text,
  Textarea,
  tkn,
  useUI,
} from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';

const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;

export interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDto | undefined;
}

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
  const [bio, setBio] = useState(profile?.bio ?? '');

  const handleSave = (): void => {
    const payload: UpdateProfileRequest = {
      firstName,
      lastName,
      phoneNumber,
      bio,
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

  const footer = (
    <FooterRow>
      {/* eslint-disable @typescript-eslint/no-unsafe-assignment */}
      <Button variant="ghost" onClick={onClose} disabled={isLoading}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={handleSave} isLoading={isLoading}>
        {/* eslint-enable @typescript-eslint/no-unsafe-assignment */}
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.profile.title')}
      subtitle={t('translation:settingsHub.drawer.profile.subtitle')}
      footer={footer}
      size="md"
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
        <Textarea
          label={t('translation:settingsHub.drawer.profile.bio')}
          value={bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setBio(e.target.value)
          }
        />
      </BodyStack>
    </Drawer>
  );
};
