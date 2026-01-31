/**
 * RegisterPage Component (Presentation)
 *
 * Purpose: Display user registration form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormDataSchema, type RegisterFormData } from '@repo/shared';
import { Icon, Logo, MeshBackground, ModernButton, ModernTextInput, Text, Typewriter } from '@repo/ui';
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
                  t('auth.branding.slogan1'),
                  t('auth.branding.slogan2'),
                  t('auth.branding.slogan3'),
                  t('auth.branding.slogan4'),
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
            <S.BackLink onClick={() => window.history.back()}>
              <Icon name="chevron-left" size="sm" />
              {t('auth.register.backToDashboard')}
            </S.BackLink>

            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth.register.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth.register.subtitle')}
              </Text>
            </S.Header>

            <S.Form onSubmit={handleSubmit(onSubmit)}>
              <S.FormRow>
                <ModernTextInput
                  name="firstName"
                  control={control}
                  label={t('auth.register.firstNameLabel')}
                  placeholder={t('auth.register.firstNamePlaceholder')}
                  isDisabled={isLoading || isSubmitting}
                />
                <ModernTextInput
                  name="lastName"
                  control={control}
                  label={t('auth.register.lastNameLabel')}
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  isDisabled={isLoading || isSubmitting}
                />
              </S.FormRow>

              <ModernTextInput
                name="email"
                control={control}
                label={t('auth.register.emailLabel')}
                placeholder={t('auth.register.emailPlaceholder')}
                type="email"
                isDisabled={isLoading || isSubmitting}
              />

              <ModernTextInput
                name="password"
                control={control}
                label={t('auth.register.passwordLabel')}
                placeholder={t('auth.register.passwordPlaceholder')}
                type="password"
                isDisabled={isLoading || isSubmitting}
              />

              <ModernTextInput
                name="confirmPassword"
                control={control}
                label={t('auth.register.confirmPasswordLabel')}
                placeholder={t('auth.register.confirmPasswordPlaceholder')}
                type="password"
                isDisabled={isLoading || isSubmitting}
              />

              <S.ButtonContainer>
                <ModernButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading || isSubmitting}
                  size="large"
                >
                  {t('auth.register.submitButton')}
                </ModernButton>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth.register.alreadyHaveAccount')}
              </Text>
              <S.FooterLink type="button" onClick={onNavigateToLogin}>
                {t('auth.register.loginLink')}
              </S.FooterLink>
            </S.Footer>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
