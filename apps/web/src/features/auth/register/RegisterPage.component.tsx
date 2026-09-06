/**
 * RegisterPage Component (Presentation)
 *
 * Purpose: Display user registration form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormDataSchema, type RegisterFormData } from '@repo/shared';
import { Button, Icon, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShowcase } from '../shared/AuthShowcase';

import * as S from './RegisterPage.style';
import type { RegisterPageComponentProps } from './RegisterPage.types';

export const RegisterPageComponent = ({
  onSubmit,
  isLoading,
  onNavigateToLogin,
  onGoogleSignIn,
  isGoogleLoading,
  googleEnabled,
}: RegisterPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation', 'auth']);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormDataSchema(t)),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
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
                {t('auth:auth.register.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.register.subtitle')}
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
              <S.FormRow>
                <ModernTextInput
                  name="firstName"
                  control={control}
                  label={t('auth:auth.register.firstNameLabel')}
                  isDisabled={isLoading || isSubmitting}
                />
                <ModernTextInput
                  name="lastName"
                  control={control}
                  label={t('auth:auth.register.lastNameLabel')}
                  isDisabled={isLoading || isSubmitting}
                />
              </S.FormRow>

              <ModernTextInput
                name="email"
                control={control}
                label={t('auth:auth.register.emailLabel')}
                type="email"
                isDisabled={isLoading || isSubmitting}
              />

              <ModernTextInput
                name="password"
                control={control}
                label={t('auth:auth.register.passwordLabel')}
                type="password"
                isDisabled={isLoading || isSubmitting}
              />

              <ModernTextInput
                name="confirmPassword"
                control={control}
                label={t('auth:auth.register.confirmPasswordLabel')}
                type="password"
                isDisabled={isLoading || isSubmitting}
              />

              <S.ButtonContainer>
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading || isSubmitting} size="large">
                  <Text>{t('auth:auth.register.submitButton')}</Text>
                </Button>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.register.alreadyHaveAccount')}
              </Text>
              <S.FooterLink type="button" variant="text" onClick={onNavigateToLogin}>
                {t('auth:auth.register.loginLink')}
              </S.FooterLink>
            </S.Footer>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
