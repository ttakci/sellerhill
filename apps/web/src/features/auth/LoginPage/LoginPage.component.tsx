/**
 * LoginPage Component (Presentation)
 *
 * Purpose: Display user login form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormDataSchema, type LoginFormData } from '@repo/shared';
import { Button, Icon, Text, TextInput } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './LoginPage.style';
import type { LoginPageComponentProps } from './LoginPage.types';

export const LoginPageComponent = ({
  onSubmit,
  isLoading,
  onNavigateToRegister,
}: LoginPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormDataSchema(t)),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <S.Container>
      <S.LayoutWrapper>
        {/* Left Panel: Form */}
        <S.LeftPanel>
          <S.AuthCard>
            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth.login.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth.login.welcomeBack')}
              </Text>
            </S.Header>

            <S.Form onSubmit={handleSubmit(onSubmit)}>
              <TextInput
                name="email"
                control={control}
                label={t('auth.login.emailLabel')}
                placeholder={t('auth.login.emailPlaceholder')}
                type="email"
                disabled={isLoading || isSubmitting}
                leftIcon="mail"
              />

              <TextInput
                name="password"
                control={control}
                label={t('auth.login.passwordLabel')}
                placeholder={t('auth.login.passwordPlaceholder')}
                type="password"
                disabled={isLoading || isSubmitting}
                leftIcon="lock"
              />

              <S.ButtonContainer>
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading || isSubmitting} size="lg">
                  {t('auth.login.submitButton')}
                </Button>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth.login.noAccount')}
              </Text>
              <S.FooterLink type="button" onClick={onNavigateToRegister}>
                {t('auth.login.registerLink')}
              </S.FooterLink>
            </S.Footer>
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
                Zonds
              </Text>
            </S.BrandingLogoWrapper>
            
            <Text variant="h3" weight="medium" color="text.inverse">
              {t('auth.login.subtitle')}
            </Text>
            
            <Text variant="body" color="text.inverse" style={{ opacity: 0.8 }}>
              Tüm pazar yeri süreçlerinizi tek bir noktadan yöneterek işinizi kolaylaştırın.
            </Text>

            <div style={{ marginTop: '2rem' }}>
              <Icon name="inbox" size={200} color="text.inverse" style={{ opacity: 0.1 }} />
            </div>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
