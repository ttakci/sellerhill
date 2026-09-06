/**
 * LoginPage Component (Presentation)
 *
 * Purpose: Display user login form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormDataSchema, type LoginFormData } from '@repo/shared';
import { Button, Icon, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShowcase } from '../shared/AuthShowcase';

import * as S from './LoginPage.style';
import type { LoginPageComponentProps } from './LoginPage.types';

export const LoginPageComponent = ({
  onSubmit,
  isLoading,
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onGoogleSignIn,
  isGoogleLoading,
  googleEnabled,
}: LoginPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation', 'auth']);

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
        {/* Left Panel: Branding + demo showcase */}
        <AuthShowcase />

        {/* Right Panel: Form */}
        <S.FormPanel>
          <S.AuthCard>
            <S.Header>
              <Text variant="display" weight="bold">
                {t('auth:auth.login.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.login.subtitle')}
              </Text>
            </S.Header>

            {googleEnabled ? (
              <>
                <S.GoogleButtonRow>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    size="large"
                    isLoading={isGoogleLoading}
                    disabled={isLoading || isSubmitting || isGoogleLoading}
                    onClick={onGoogleSignIn}
                  >
                    <Icon name="brand-google" size="md" />
                    <Text>{t('auth:auth.register.signUpWithGoogle')}</Text>
                  </Button>
                </S.GoogleButtonRow>
                <S.OrDivider>
                  <Text variant="body-sm" color="text.secondary">
                    {t('auth:auth.register.orDivider')}
                  </Text>
                </S.OrDivider>
              </>
            ) : null}

            <S.Form
              onSubmit={(e) => {
                void handleSubmit(onSubmit)(e);
              }}
            >
              <ModernTextInput
                name="email"
                control={control}
                label={t('auth:auth.login.emailLabel')}
                type="email"
                isDisabled={isLoading || isSubmitting}
              />

              <ModernTextInput
                name="password"
                control={control}
                label={t('auth:auth.login.passwordLabel')}
                type="password"
                isDisabled={isLoading || isSubmitting}
              />

              <S.ForgotRow>
                <S.ForgotLink type="button" variant="text" onClick={onNavigateToForgotPassword}>
                  {t('auth:auth.login.forgotPasswordLink')}
                </S.ForgotLink>
              </S.ForgotRow>

              <S.ButtonContainer>
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading || isSubmitting} size="large">
                  <Text>{t('auth:auth.login.submitButton')}</Text>
                </Button>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.login.noAccount')}
              </Text>
              <S.FooterLink type="button" variant="text" onClick={onNavigateToRegister}>
                {t('auth:auth.login.registerLink')}
              </S.FooterLink>
            </S.Footer>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
