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
              <S.LogoText variant="h2" weight="bold" color="brand.primary">
                {t('translation:common.brandName')}
              </S.LogoText>
            </S.LogoWrapper>

            <S.IconContainer>
              <Icon name="mail" size={40} />
            </S.IconContainer>

            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth:auth.checkEmail.header')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.checkEmail.description', { email })}
              </Text>
            </S.Header>

            <S.ActionGroup>
              <Button onClick={onBackToLogin} variant="primary" fullWidth size="large">
                {t('auth:auth.checkEmail.loginButton')}
              </Button>

              <S.ResendInfo variant="body" color="text.secondary">
                {t('auth:auth.checkEmail.noEmail')}
              </S.ResendInfo>

              <S.ResendButton variant="text" onClick={onResend} disabled={isResending}>
                {isResending ? t('translation:common.loading') : t('auth:auth.checkEmail.resendLink')}
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
              {t('auth:auth.checkEmail.title')}
            </Text>

            <S.BrandingDescription variant="body" color="text.inverse">
              {t('auth:auth.checkEmail.brandingText')}
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
