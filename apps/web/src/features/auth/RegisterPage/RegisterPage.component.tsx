/**
 * RegisterPage Component (Presentation)
 *
 * Purpose: Display user registration form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormDataSchema, type RegisterFormData } from '@repo/shared';
import { Button, Icon, Text, TextInput } from '@repo/ui';
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
  const { t } = useTranslation(['auth', 'translation']);

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
        {/* Left Panel: Form */}
        <S.LeftPanel>
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
                <TextInput
                  name="firstName"
                  control={control}
                  label={t('auth.register.firstNameLabel')}
                  placeholder={t('auth.register.firstNamePlaceholder')}
                  disabled={isLoading || isSubmitting}
                />
                <TextInput
                  name="lastName"
                  control={control}
                  label={t('auth.register.lastNameLabel')}
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  disabled={isLoading || isSubmitting}
                />
              </S.FormRow>

              <TextInput
                name="email"
                control={control}
                label={t('auth.register.emailLabel')}
                placeholder={t('auth.register.emailPlaceholder')}
                type="email"
                disabled={isLoading || isSubmitting}
              />

              <TextInput
                name="password"
                control={control}
                label={t('auth.register.passwordLabel')}
                placeholder={t('auth.register.passwordPlaceholder')}
                type="password"
                disabled={isLoading || isSubmitting}
              />

              <TextInput
                name="confirmPassword"
                control={control}
                label={t('auth.register.confirmPasswordLabel')}
                placeholder={t('auth.register.confirmPasswordPlaceholder')}
                type="password"
                disabled={isLoading || isSubmitting}
              />

              <S.ButtonContainer>
                <Button 
                  type="submit" 
                  variant="primary" 
                  fullWidth 
                  isLoading={isLoading || isSubmitting} 
                  size="lg"
                >
                  {t('auth.register.submitButton')}
                </Button>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth.register.haveAccount')}
              </Text>
              <S.FooterLink type="button" onClick={onNavigateToLogin}>
                {t('auth.register.loginLink')}
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
            <S.LogoWrapper>
              <Icon name="logo" size={64} color="text.inverse" />
              <Text variant="h1" weight="bold" color="text.inverse">
                Zonds
              </Text>
            </S.LogoWrapper>
            
            <Text variant="h3" weight="medium" color="text.inverse">
              {t('auth.register.startFree')}
            </Text>
            
            <Text variant="body" color="text.inverse" style={{ opacity: 0.8 }}>
              Zonds ile e-ticaret sitelerinizi tek bir yerden yönetin, envanterinizi senkronize edin ve satışlarınızı artırın.
            </Text>

            <div style={{ marginTop: '2rem' }}>
              <Icon name="zorro" size={200} color="text.inverse" style={{ opacity: 0.1 }} />
            </div>
          </S.BrandingContent>
        </S.RightPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
