/**
 * CheckEmailPage Component
 *
 * Purpose: Verification link sent confirmation
 */

import { Button, Icon, Text } from '@repo/ui';
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
        {/* Left Panel: Content */}
        <S.LeftPanel>
          <S.AuthCard>
            <S.LogoWrapper>
              <Icon name="logo" size={48} color="brand.primary" />
              <Text variant="h2" weight="bold" color="brand.primary" style={{ marginTop: '1rem' }}>
                {t('translation:common.brandName')}
              </Text>
            </S.LogoWrapper>

            <S.IconContainer>
              <Icon name="mail" size={40} />
            </S.IconContainer>

            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth.checkEmail.header')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth.checkEmail.description', { email })}
              </Text>
            </S.Header>

            <S.ActionGroup>
              <Button onClick={onBackToLogin} variant="primary" fullWidth size="lg">
                {t('auth.checkEmail.loginButton')}
              </Button>

              <Text variant="body" color="text.secondary" style={{ marginTop: '1.5rem' }}>
                {t('auth.checkEmail.noEmail')}
              </Text>

              <S.ResendButton onClick={onResend} disabled={isResending}>
                {isResending ? t('common.loading') : t('auth.checkEmail.resendLink')}
              </S.ResendButton>
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
              {t('auth.checkEmail.title')}
            </Text>

            <Text variant="body" color="text.inverse" style={{ opacity: 0.8 }}>
              {t('auth.checkEmail.brandingText')}
            </Text>

            <div style={{ marginTop: '2rem' }}>
              <Icon name="mail" size={200} color="text.inverse" style={{ opacity: 0.1 }} />
            </div>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
