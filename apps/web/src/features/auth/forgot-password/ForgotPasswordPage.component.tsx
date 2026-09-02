/**
 * ForgotPasswordPage Component (Presentation)
 *
 * Two states: the email-entry form and, once a request has been accepted, a
 * "check your email" confirmation panel (identical response whether or not an
 * account exists).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@repo/shared';
import { Button, Icon, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShowcase } from '../shared/AuthShowcase';

import * as S from './ForgotPasswordPage.style';
import type { ForgotPasswordPageComponentProps } from './ForgotPasswordPage.types';

export const ForgotPasswordPageComponent = ({
  onSubmit,
  isLoading,
  submitted,
  submittedEmail,
  onResend,
  onBackToLogin,
}: ForgotPasswordPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation', 'auth']);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema(t)),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  return (
    <S.Container>
      <S.LayoutWrapper>
        <AuthShowcase />

        <S.FormPanel>
          {submitted ? (
            <S.ConfirmCard>
              <S.IconContainer>
                <Icon name="mail" size={44} />
              </S.IconContainer>

              <S.ConfirmHeader>
                <Text variant="h2" weight="semibold">
                  {t('auth:auth.passwordReset.forgot.sentHeader')}
                </Text>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.forgot.sentDescription', { email: submittedEmail })}
                </Text>
              </S.ConfirmHeader>

              <S.ActionGroup>
                <Button onClick={onBackToLogin} variant="primary" fullWidth size="large">
                  <Text variant="body" weight="medium" color="text.inverse">
                    {t('auth:auth.passwordReset.forgot.backToLogin')}
                  </Text>
                </Button>
              </S.ActionGroup>

              <S.ResendRow>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.forgot.noEmail')}
                </Text>
                <S.ResendButton variant="text" onClick={onResend} disabled={isLoading}>
                  <Text variant="body" weight="medium" color="brand.primary">
                    {isLoading
                      ? t('translation:common.loading')
                      : t('auth:auth.passwordReset.forgot.resendLink')}
                  </Text>
                </S.ResendButton>
              </S.ResendRow>
            </S.ConfirmCard>
          ) : (
            <S.AuthCard>
              <S.Header>
                <Text variant="h2" weight="semibold">
                  {t('auth:auth.passwordReset.forgot.title')}
                </Text>
                <Text variant="body" color="text.secondary">
                  {t('auth:auth.passwordReset.forgot.subtitle')}
                </Text>
              </S.Header>

              <S.Form
                onSubmit={(e) => {
                  void handleSubmit(onSubmit)(e);
                }}
              >
                <ModernTextInput
                  name="email"
                  control={control}
                  label={t('auth:auth.passwordReset.forgot.emailLabel')}
                  type="email"
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
                    <Text>{t('auth:auth.passwordReset.forgot.submitButton')}</Text>
                  </Button>
                </S.ButtonContainer>
              </S.Form>

              <S.Footer>
                <S.FooterLink type="button" variant="text" onClick={onBackToLogin}>
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
