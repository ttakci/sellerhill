/**
 * VerifyEmailPage Component
 *
 * Purpose: Email verification status display
 */

import { Button, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './VerifyEmailPage.style';
import type { VerifyEmailPageProps } from './VerifyEmailPage.types';

export const VerifyEmailPageComponent = ({
  status,
  onResendVerification,
  onNavigateToLogin,
}: VerifyEmailPageProps): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);

  const getStatusContent = () => {
    switch (status) {
      case 'loading':
        return {
          icon: <Icon name="loader" size={40} />,
          title: t('auth:auth.verification.verifying'),
          description: t('auth:auth.verification.waiting'),
          type: 'loading' as const,
        };
      case 'success':
        return {
          icon: <Icon name="check" size={40} />,
          title: t('auth:auth.verification.title'),
          description: t('auth:auth.verification.success'),
          type: 'success' as const,
        };
      case 'error':
        return {
          icon: <Icon name="alert-circle" size={40} />,
          title: t('auth:auth.verification.error'),
          description: t('auth:auth.verification.invalid'),
          type: 'error' as const,
        };
      default:
        return {
          icon: <Icon name="loader" size={40} />,
          title: t('auth:auth.verification.verifying'),
          description: t('auth:auth.verification.waiting'),
          type: 'loading' as const,
        };
    }
  };

  const content = getStatusContent();

  return (
    <S.Container>
      <S.LayoutWrapper>
        {/* Left Panel: Content */}
        <S.LeftPanel>
          <S.AuthCard>
            <S.LogoWrapper>
              <Icon name="logo" size={48} color="brand.primary" />
              <S.LogoText variant="h2" weight="bold" color="brand.primary">
                {t('translation:common.brandName')}
              </S.LogoText>
            </S.LogoWrapper>

            <S.StatusIconWrapper $type={content.type}>{content.icon}</S.StatusIconWrapper>

            <S.Header>
              <Text variant="h2" weight="bold">
                {content.title}
              </Text>
              <Text variant="body" color="text.secondary">
                {content.description}
              </Text>
            </S.Header>

            <S.ActionGroup>
              <Button onClick={onNavigateToLogin} variant="primary" fullWidth size="large">
                {t('auth:auth.register.loginLink')}
              </Button>
              {status === 'error' && (
                <S.ResendButton variant="text" onClick={onResendVerification}>{t('auth:auth.verification.resendButton')}</S.ResendButton>
              )}
            </S.ActionGroup>
          </S.AuthCard>
        </S.LeftPanel>

        {/* Right Panel: Branding */}
        <S.RightPanel>
          <S.MosaicDecor>
            <div className="box-1" />
            <div className="box-2" />
            <div className="box-3" />
            <div className="box-4" />
          </S.MosaicDecor>
          <S.BrandingContent>
            <S.BrandingLogoWrapper>
              <Icon name="logo" size={64} color="text.inverse" />
              <Text variant="h1" weight="bold" color="text.inverse">
                {t('translation:common.brandName')}
              </Text>
            </S.BrandingLogoWrapper>

            <Text variant="h3" weight="medium" color="text.inverse">
              {t('auth:auth.verification.title')}
            </Text>

            <S.BrandingDescription variant="body" color="text.inverse">
              {t('auth:auth.verification.brandingText')}
            </S.BrandingDescription>

            <S.BrandingIconContainer>
              <Icon name="mail" size={200} color="text.inverse" />
            </S.BrandingIconContainer>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
