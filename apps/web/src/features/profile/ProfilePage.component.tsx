import { Button, Card, Icon, ModernTextInput, PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ProfilePage.style';
import type { ProfilePageComponentProps } from './ProfilePage.types';

export const ProfilePageComponent: React.FC<ProfilePageComponentProps> = ({
  profile,
  control,
  errors: _errors,
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
  const renderField = (label: string, value: string | undefined, fieldName: string, fullWidth = false) => (
    <S.InfoItem $fullWidth={fullWidth || undefined}>
      {!isEditing && <S.InfoLabel>{label}</S.InfoLabel>}
      {isEditing ? (
        <ModernTextInput
          name={fieldName}
          control={control}
          label={label}
          fullWidth={fullWidth}
          isDisabled={isLoading}
        />
      ) : (
        <S.InfoValue>{value || '-'}</S.InfoValue>
      )}
    </S.InfoItem>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        actions={
          <Button variant={isEditing ? 'secondary' : 'primary'} onClick={onToggleEdit} disabled={isLoading}>
            <Icon name={isEditing ? 'x' : 'edit'} size={18} />
            {isEditing ? t('translation:common.cancel') : t('profile.edit')}
          </Button>
        }
      />

      <form onSubmit={(e) => { void onSubmit(e); }}>
        {/* Section 1: User Overview */}
        <Card variant="default" padding="lg">
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
                  <S.BadgeItem variant="neutral" size="xs">{role}</S.BadgeItem>
                  <S.BadgeItem variant="neutral" size="xs">
                    <Icon name="map-pin" size={14} />
                    {location}
                  </S.BadgeItem>
                </S.ProfileBadges>
              </S.ProfileHeaderContent>
            </S.UserOverviewLeft>
          </S.UserOverview>
        </Card>

        {/* Section 2: Personal Information */}
        <S.SectionCard>
          <Card variant="default" padding="none">
            <S.SectionTitleWrapper>
              <Text variant="body" weight="bold">
                {t('profile.personalInfo')}
              </Text>
            </S.SectionTitleWrapper>
            <S.SectionContent>
              {renderField(t('profile.firstName'), profile.firstName, 'firstName')}
              {renderField(t('profile.lastName'), profile.lastName, 'lastName')}
              {renderField(t('profile.emailAddress'), profile.email, 'email')}
              {renderField(t('profile.phone'), profile.phoneNumber, 'phoneNumber')}
              {renderField(t('profile.bio'), profile.bio, 'bio', true)}
            </S.SectionContent>
          </Card>
        </S.SectionCard>

        {/* Section 3: Address */}
        <S.SectionCard>
          <Card variant="default" padding="none">
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
        </Card>
        </S.SectionCard>

        {/* Footer Actions */}
        <S.FooterActions>
          <S.DeleteButton variant="danger" type="button">{t('profile.deactivateAccount')}</S.DeleteButton>
          {isEditing && (
            <Button variant="primary" size="medium" type="submit" isLoading={isLoading}>
              <Text>{t('profile.saveChanges')}</Text>
            </Button>
          )}
        </S.FooterActions>
      </form>
    </S.Container>
  );
};
