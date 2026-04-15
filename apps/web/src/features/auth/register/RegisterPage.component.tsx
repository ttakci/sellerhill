/**
 * RegisterPage Component (Presentation)
 *
 * Purpose: Display user registration form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormDataSchema, type RegisterFormData } from '@repo/shared';
import { Button, Icon, Logo, MeshBackground, ModernTextInput, Text, Typewriter } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './RegisterPage.style';
import type { RegisterPageComponentProps } from './RegisterPage.types';

export const RegisterPageComponent = ({
  onSubmit,
  isLoading,
  onNavigateToLogin,
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

        {/* Right Panel: Form */}
        <S.FormPanel>
          <S.AuthCard>
            <S.BackLink variant="text" onClick={() => window.history.back()}>
              <Icon name="chevron-left" size="sm" />
              {t('auth:auth.register.backToDashboard')}
            </S.BackLink>

            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth:auth.register.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth:auth.register.subtitle')}
              </Text>
            </S.Header>

            <S.Form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
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
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading || isSubmitting}
                  size="large"
                >
                  {t('auth:auth.register.submitButton')}
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
