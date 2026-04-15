/**
 * VerifyEmailPage Component
 *
 * Purpose: Email verification status display
 * Two-panel layout — consistent with Login / Register / CheckEmail pages.
 */

import { Button, Icon, Logo, MeshBackground, Text, Typewriter } from '@repo/ui';
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
          icon: <Icon name="loader" size={44} />,
          title: t('auth:auth.verification.verifying'),
          description: t('auth:auth.verification.waiting'),
          type: 'loading' as const,
        };
      case 'success':
        return {
          icon: <Icon name="check" size={44} />,
          title: t('auth:auth.verification.title'),
          description: t('auth:auth.verification.success'),
          type: 'success' as const,
        };
      case 'error':
        return {
          icon: <Icon name="alert-circle" size={44} />,
          title: t('auth:auth.verification.error'),
          description: t('auth:auth.verification.invalid'),
          type: 'error' as const,
        };
      default:
        return {
          icon: <Icon name="loader" size={44} />,
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
        {/* Left Panel: Branding */}
        <S.BrandingPanel>
          <S.DecorationArea>
            <MeshBackground animate={true} />
          </S.DecorationArea>

          <S.BrandingContent>
            <S.BrandingLogoWrapper>
              <Logo size={520} />
            </S.BrandingLogoWrapper>

            <S.SloganWrapper>
              <Typewriter
                phrases={[
                  t('auth:auth.branding.slogan1'),
                  t('auth:auth.branding.slogan2'),
                  t('auth:auth.branding.slogan3'),
                  t('auth:auth.branding.slogan4'),
                ]}
                typingSpeed={70}
                deletingSpeed={40}
                pauseTime={2500}
              />
            </S.SloganWrapper>
          </S.BrandingContent>
        </S.BrandingPanel>

        {/* Right Panel: Content */}
        <S.FormPanel>
          <S.AuthCard>
            <S.StatusIconWrapper $type={content.type}>{content.icon}</S.StatusIconWrapper>

            <S.Header>
              <Text variant="h3" weight="bold">
                {content.title}
              </Text>
              <Text variant="body" color="text.secondary">
                {content.description}
              </Text>
            </S.Header>

            <S.ActionGroup>
              <Button onClick={onNavigateToLogin} variant="primary" fullWidth size="large">
                <Text variant="body" weight="medium" color="text.inverse">
                  {t('auth:auth.register.loginLink')}
                </Text>
              </Button>
              {status === 'error' && (
                <S.ResendButton variant="text" onClick={onResendVerification}>
                  <Text variant="body" weight="medium" color="brand.primary">
                    {t('auth:auth.verification.resendButton')}
                  </Text>
                </S.ResendButton>
              )}
            </S.ActionGroup>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
