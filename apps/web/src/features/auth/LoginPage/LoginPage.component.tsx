/**
 * LoginPage Component (Presentation)
 *
 * Purpose: Display user login form with validation
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormDataSchema, type LoginFormData } from '@repo/shared';
import { Button, TextInput } from '@repo/ui';
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
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormDataSchema(t)),
    mode: 'onBlur',
  });

  return (
    <S.Container>
      <S.Card>
        <S.Header>
          <S.Title>{t('auth.login.title')}</S.Title>
          <S.Subtitle>{t('auth.login.subtitle')}</S.Subtitle>
        </S.Header>

        <S.Form onSubmit={handleSubmit(onSubmit)}>
          <TextInput
            name="email"
            control={control}
            label={t('auth.login.emailLabel')}
            type="email"
            disabled={isLoading || isSubmitting}
          />

          <TextInput
            name="password"
            control={control}
            label={t('auth.login.passwordLabel')}
            type="password"
            disabled={isLoading || isSubmitting}
          />

          <S.ButtonContainer>
            <Button type="submit" variant="primary" fullWidth disabled={isLoading || isSubmitting}>
              {t('auth.login.submitButton')}
            </Button>
          </S.ButtonContainer>
        </S.Form>

        <S.Footer>
          {t('auth.login.noAccount')}
          <S.FooterLink type="button" onClick={onNavigateToRegister}>
            {t('auth.login.registerLink')}
          </S.FooterLink>
        </S.Footer>
      </S.Card>
    </S.Container>
  );
};
