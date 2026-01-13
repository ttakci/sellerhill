/**
 * RegisterPage Component (Presentation)
 *
 * Purpose: Display user registration form with validation
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { registerFormDataSchema, type RegisterFormData } from '@repo/shared';
import { Button, TextInput } from '@repo/ui';
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
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormDataSchema(t)),
    mode: 'onBlur',
  });

  return (
    <S.Container>
      <S.Card>
        <S.Header>
          <S.Title>{t('auth.register.title')}</S.Title>
          <S.Subtitle>{t('auth.register.subtitle')}</S.Subtitle>
        </S.Header>

        <S.Form onSubmit={handleSubmit(onSubmit)}>
          <S.FormRow>
            <TextInput
              name="firstName"
              control={control}
              label={t('auth.register.firstNameLabel')}
              disabled={isLoading || isSubmitting}
              fullWidth
            />

            <TextInput
              name="lastName"
              control={control}
              label={t('auth.register.lastNameLabel')}
              disabled={isLoading || isSubmitting}
              fullWidth
            />
          </S.FormRow>

          <TextInput
            name="email"
            control={control}
            label={t('auth.register.emailLabel')}
            type="email"
            disabled={isLoading || isSubmitting}
          />

          <TextInput
            name="password"
            control={control}
            label={t('auth.register.passwordLabel')}
            type="password"
            disabled={isLoading || isSubmitting}
          />

          <TextInput
            name="confirmPassword"
            control={control}
            label={t('auth.register.confirmPasswordLabel')}
            type="password"
            disabled={isLoading || isSubmitting}
          />

          <S.ButtonContainer>
            <Button type="submit" variant="primary" fullWidth disabled={isLoading || isSubmitting}>
              {t('auth.register.submitButton')}
            </Button>
          </S.ButtonContainer>
        </S.Form>

        <S.Footer>
          {t('auth.register.alreadyHaveAccount')}
          <S.FooterLink type="button" onClick={onNavigateToLogin}>
            {t('auth.register.loginLink')}
          </S.FooterLink>
        </S.Footer>
      </S.Card>
    </S.Container>
  );
};
