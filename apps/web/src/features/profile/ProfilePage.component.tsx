import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileFormData } from '@repo/shared';
import { Button, Icon, Text } from '@repo/ui';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as S from './ProfilePage.style';
import type { ProfilePageComponentProps } from './ProfilePage.types';

export const ProfilePageComponent: React.FC<ProfilePageComponentProps> = ({
  profile,
  onSubmit,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const {
    handleSubmit,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema(t)),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber || '',
      avatarUrl: profile.avatarUrl || '',
      jobTitle: profile.jobTitle || '',
      bio: profile.bio || '',
      country: profile.country || '',
      cityState: profile.cityState || '',
      postalCode: profile.postalCode || '',
      taxId: profile.taxId || '',
    },
  });

  const userName = `${profile.firstName} ${profile.lastName}`;

  return (
    <S.Container>
      {/* Page Header */}
      <S.Header>
        <Text variant="h3" weight="bold">
          {t('profile.title')}
        </Text>
        <S.BreadcrumbList>
          <a href="/">{t('profile.home')}</a>
          <span> &gt; </span>
          <strong>{t('profile.title')}</strong>
        </S.BreadcrumbList>
      </S.Header>

      <S.MainCard>
        <Text variant="h4" weight="bold">
          {t('profile.title')}
        </Text>

        {/* Section 1: Basic Info */}
        <S.SectionCard>
          <S.UserOverview>
            <S.UserInfoWrapper>
              <S.AvatarContainer>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={userName} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyItems: 'center', background: '#f3f4f6' }}>
                     <Icon name="user" size={40} color="text.tertiary" />
                  </div>
                )}
              </S.AvatarContainer>
              <S.UserTextInfo>
                <Text variant="h4" weight="bold">{userName}</Text>
                <Text variant="body" color="text.tertiary">
                  {profile.jobTitle || 'Team Manager'} | {profile.cityState || 'Location not set'}
                </Text>
              </S.UserTextInfo>
            </S.UserInfoWrapper>
            <S.ActionGroup>
               <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  <Icon name="edit" size={14} />
                  <span>{t('profile.edit')}</span>
               </Button>
            </S.ActionGroup>
          </S.UserOverview>
        </S.SectionCard>

        {/* Section 2: Personal Information */}
        <S.SectionCard>
          <S.SectionHeader>
            <Text variant="body" weight="bold">{t('profile.personalInfo')}</Text>
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
               <Icon name="edit" size={14} />
               <span>{t('profile.edit')}</span>
            </Button>
          </S.SectionHeader>
          <S.InfoGrid>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.firstName')}</S.InfoLabel>
              <S.InfoValue>{profile.firstName}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.lastName')}</S.InfoLabel>
              <S.InfoValue>{profile.lastName}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.emailAddress')}</S.InfoLabel>
              <S.InfoValue>{profile.email}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.phone')}</S.InfoLabel>
              <S.InfoValue>{profile.phoneNumber || 'Not provided'}</S.InfoValue>
            </S.InfoItem>
            <S.BioItem>
              <S.InfoLabel>{t('profile.bio')}</S.InfoLabel>
              <S.InfoValue>{profile.bio || 'Professional e-commerce manager.'}</S.InfoValue>
            </S.BioItem>
          </S.InfoGrid>
        </S.SectionCard>

        {/* Section 3: Address */}
        <S.SectionCard>
          <S.SectionHeader>
            <Text variant="body" weight="bold">{t('profile.address')}</Text>
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
               <Icon name="edit" size={14} />
               <span>{t('profile.edit')}</span>
            </Button>
          </S.SectionHeader>
          <S.InfoGrid>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.country')}</S.InfoLabel>
              <S.InfoValue>{profile.country || 'Not set'}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.cityState')}</S.InfoLabel>
              <S.InfoValue>{profile.cityState || 'Not set'}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.postalCode')}</S.InfoLabel>
              <S.InfoValue>{profile.postalCode || 'Not set'}</S.InfoValue>
            </S.InfoItem>
            <S.InfoItem>
              <S.InfoLabel>{t('profile.taxId')}</S.InfoLabel>
              <S.InfoValue>{profile.taxId || 'Not set'}</S.InfoValue>
            </S.InfoItem>
          </S.InfoGrid>
        </S.SectionCard>
      </S.MainCard>
    </S.Container>
  );
};
