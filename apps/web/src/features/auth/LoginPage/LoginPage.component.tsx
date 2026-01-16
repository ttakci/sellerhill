/**
 * LoginPage Component (Presentation)
 *
 * Purpose: Display user login form with validation
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
  const { t } = useTranslation();

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
      <S.AuthCard>
        <S.Header>
          <S.LogoWrapper>
            <S.LogoIcon>
              <Icon name="inbox" size={28} />
            </S.LogoIcon>
          </S.LogoWrapper>
          <Text variant="h2" weight="bold" color="text.primary">
            {t('auth.login.title')}
          </Text>
          <S.SubtitleWrapper>
            <Text variant="body" color="text.secondary">
              {t('auth.login.subtitle')}
            </Text>
          </S.SubtitleWrapper>
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
            <Button type="submit" variant="primary" fullWidth isLoading={isLoading || isSubmitting}>
              {t('auth.login.submitButton')}
            </Button>
          </S.ButtonContainer>
        </S.Form>

        <S.Footer>
          <Text variant="caption" color="text.tertiary">
            {t('auth.login.noAccount')}
          </Text>
          <S.FooterLink type="button" onClick={onNavigateToRegister}>
            {t('auth.login.registerLink')}
          </S.FooterLink>
        </S.Footer>
      </S.AuthCard>
    </S.Container>
  );
};
