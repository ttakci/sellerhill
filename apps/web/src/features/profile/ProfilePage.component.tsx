import { type UpdateProfileFormData } from '@repo/shared';
import { Button, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ProfilePage.style';
import type { ProfilePageComponentProps } from './ProfilePage.types';

export const ProfilePageComponent: React.FC<ProfilePageComponentProps> = ({
  profile,
  register,
  errors,
  onSubmit,
  isLoading,
  isEditing,
  onToggleEdit,
}) => {
  const { t } = useTranslation(['profile', 'translation']);

  const userName = `${profile.firstName} ${profile.lastName}`;
  const role = profile.jobTitle || t('profile.storeOwner');
  const location = profile.cityState || t('profile.locationNotSet');

  // Helper to render field or input
  const renderField = (label: string, value: string | undefined, fieldName: any, fullWidth = false) => (
    <S.InfoItem style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <S.InfoLabel>{label}</S.InfoLabel>
      {isEditing ? (
        <>
          <S.CleanInput {...register(fieldName as any)} defaultValue={value} />
          {errors[fieldName as keyof UpdateProfileFormData] && (
            <S.ErrorMessage>
              <Text variant="caption" color="text.error">
                {errors[fieldName as keyof UpdateProfileFormData]?.message}
              </Text>
            </S.ErrorMessage>
          )}
        </>
      ) : (
        <S.InfoValue>{value || '-'}</S.InfoValue>
      )}
    </S.InfoItem>
  );

  return (
    <S.Container>
      <S.Header>
        <S.TitleSection>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </S.TitleSection>
        <S.Actions>
          <Button variant={isEditing ? 'secondary' : 'primary'} onClick={onToggleEdit} disabled={isLoading}>
            <Icon name={isEditing ? 'x' : 'edit'} size={18} />
            {isEditing ? t('translation:common.cancel') : t('profile.edit')}
          </Button>
        </S.Actions>
      </S.Header>

      <form onSubmit={onSubmit}>
        {/* Section 1: User Overview */}
        <S.MainCard>
          <S.UserOverview>
            <S.UserOverviewLeft>
              <S.AvatarWrapper>
                {profile.avatarUrl ? (
                  <S.AvatarImage src={profile.avatarUrl} alt={userName} />
                ) : (
                  <S.FallbackAvatar>
                    <Icon name="user" size={40} color="text.tertiary" />
                  </S.FallbackAvatar>
                )}
              </S.AvatarWrapper>

              <S.ProfileHeaderContent>
                <Text variant="h3" weight="bold">
                  {userName}
                </Text>
                <S.ProfileBadges>
                  <S.BadgeItem>{role}</S.BadgeItem>
                  <S.BadgeItem>
                    <Icon name="map-pin" size={14} />
                    {location}
                  </S.BadgeItem>
                </S.ProfileBadges>
              </S.ProfileHeaderContent>
            </S.UserOverviewLeft>
          </S.UserOverview>
        </S.MainCard>

        {/* Section 2: Personal Information */}
        <S.PersonalInfoCard>
          <S.SectionTitleWrapper>
            <Text variant="body" weight="bold">
              {t('profile.personalInfo')}
            </Text>
          </S.SectionTitleWrapper>
          <S.SectionContent>
            {renderField(t('profile.firstName'), profile.firstName, 'firstName')}
            {renderField(t('profile.lastName'), profile.lastName, 'lastName')}
            {renderField(t('profile.emailAddress'), profile.email, 'email' as any)}
            {renderField(t('profile.phone'), profile.phoneNumber, 'phoneNumber')}
            {renderField(t('profile.bio'), profile.bio, 'bio', true)}
          </S.SectionContent>
        </S.PersonalInfoCard>

        {/* Section 3: Address */}
        <S.AddressCard>
          <S.SectionTitleWrapper>
            <Text variant="body" weight="bold">
              {t('profile.address')}
            </Text>
          </S.SectionTitleWrapper>
          <S.SectionContent>
            {renderField(t('profile.country'), profile.country, 'country')}
            {renderField(t('profile.cityState'), profile.cityState, 'cityState')}
            {renderField(t('profile.postalCode'), profile.postalCode, 'postalCode')}
          </S.SectionContent>
        </S.AddressCard>

        {/* Footer Actions */}
        <S.FooterActions>
          <S.DeleteButton type="button">{t('profile.deactivateAccount')}</S.DeleteButton>
          {isEditing && (
            <Button variant="primary" size="md" type="submit" isLoading={isLoading}>
              {t('profile.saveChanges')}
            </Button>
          )}
        </S.FooterActions>
      </form>
    </S.Container>
  );
};
