/**
 * CheckEmailPage Component
 *
 * Purpose: Verification link sent confirmation.
 * Two-panel layout — consistent with Login / Register branding.
 */

import { Button, Icon, Logo, MeshBackground, Text, Typewriter } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CheckEmailPage.style';
import type { CheckEmailPageProps } from './CheckEmailPage.types';

export const CheckEmailPageComponent = ({
  email,
  onBackToLogin,
  onResend,
  isResending,
}: CheckEmailPageProps): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);

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
            <S.IconContainer>
              <Icon name="mail" size={44} />
            </S.IconContainer>

            <S.Header>
              <Text variant="h3" weight="bold">
                {t('auth:auth.checkEmail.header')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.checkEmail.description', { email: email || '' })}
              </Text>
            </S.Header>

            <S.ActionGroup>
              <Button onClick={onBackToLogin} variant="primary" fullWidth size="large">
                <Text variant="body" weight="medium" color="text.inverse">
                  {t('auth:auth.checkEmail.loginButton')}
                </Text>
              </Button>
            </S.ActionGroup>

            <S.ResendRow>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.checkEmail.noEmail')}
              </Text>
              <S.ResendButton variant="text" onClick={onResend} disabled={isResending}>
                <Text variant="body" weight="medium" color="brand.primary">
                  {isResending ? t('translation:common.loading') : t('auth:auth.checkEmail.resendLink')}
                </Text>
              </S.ResendButton>
            </S.ResendRow>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
