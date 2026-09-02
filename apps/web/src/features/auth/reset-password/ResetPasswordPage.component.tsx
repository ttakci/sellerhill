/**
 * ResetPasswordPage Component (Presentation)
 *
 * Three states: the new-password form, a success panel (redirect follows), and
 * an error panel for a missing / invalid / expired token.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordFormData } from '@repo/shared';
import { Button, Icon, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShowcase } from '../shared/AuthShowcase';

import * as S from './ResetPasswordPage.style';
import type { ResetPasswordPageComponentProps } from './ResetPasswordPage.types';

export const ResetPasswordPageComponent = ({
  status,
  isLoading,
  onSubmit,
  onRequestNewLink,
  onNavigateToLogin,
}: ResetPasswordPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation', 'auth']);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema(t)),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  return (
    <S.Container>
      <S.LayoutWrapper>
        <AuthShowcase />

        <S.FormPanel>
          {status === 'success' && (
            <S.StatusCard>
              <S.StatusIconWrapper $type="success">
                <Icon name="check" size={44} />
              </S.StatusIconWrapper>
              <S.StatusHeader>
                <Text variant="h2" weight="semibold">
                  {t('auth:auth.passwordReset.reset.successHeader')}
                </Text>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.reset.successBody')}
                </Text>
              </S.StatusHeader>
              <S.ActionGroup>
                <Button onClick={onNavigateToLogin} variant="primary" fullWidth size="large">
                  <Text variant="body" weight="medium" color="text.inverse">
                    {t('auth:auth.passwordReset.forgot.backToLogin')}
                  </Text>
                </Button>
              </S.ActionGroup>
            </S.StatusCard>
          )}

          {status === 'error' && (
            <S.StatusCard>
              <S.StatusIconWrapper $type="error">
                <Icon name="alert-circle" size={44} />
              </S.StatusIconWrapper>
              <S.StatusHeader>
                <Text variant="h2" weight="semibold">
                  {t('auth:auth.passwordReset.reset.errorHeader')}
                </Text>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.reset.errorBody')}
                </Text>
              </S.StatusHeader>
              <S.ActionGroup>
                <Button onClick={onRequestNewLink} variant="primary" fullWidth size="large">
                  <Text variant="body" weight="medium" color="text.inverse">
                    {t('auth:auth.passwordReset.reset.requestNewLink')}
                  </Text>
                </Button>
                <Button onClick={onNavigateToLogin} variant="text" fullWidth>
                  <Text variant="body" weight="medium" color="brand.primary">
                    {t('auth:auth.passwordReset.forgot.backToLogin')}
                  </Text>
                </Button>
              </S.ActionGroup>
            </S.StatusCard>
          )}

          {status === 'form' && (
            <S.AuthCard>
              <S.Header>
                <Text variant="h2" weight="semibold">
                  {t('auth:auth.passwordReset.reset.title')}
                </Text>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.reset.subtitle')}
                </Text>
              </S.Header>

              <S.Form
                onSubmit={(e) => {
                  void handleSubmit(onSubmit)(e);
                }}
              >
                <ModernTextInput
                  name="password"
                  control={control}
                  label={t('auth:auth.passwordReset.reset.newPasswordLabel')}
                  type="password"
                  isDisabled={isLoading || isSubmitting}
                />
                <ModernTextInput
                  name="confirmPassword"
                  control={control}
                  label={t('auth:auth.passwordReset.reset.confirmPasswordLabel')}
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
                    <Text>{t('auth:auth.passwordReset.reset.submitButton')}</Text>
                  </Button>
                </S.ButtonContainer>
              </S.Form>

              <S.Footer>
                <S.FooterLink type="button" variant="text" onClick={onNavigateToLogin}>
                  {t('auth:auth.passwordReset.forgot.backToLogin')}
                </S.FooterLink>
              </S.Footer>
            </S.AuthCard>
          )}
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
