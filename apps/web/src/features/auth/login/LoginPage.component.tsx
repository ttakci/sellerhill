/**
 * LoginPage Component (Presentation)
 *
 * Purpose: Display user login form with TailAdmin design
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormDataSchema, type LoginFormData } from '@repo/shared';
import { Logo, MeshBackground, ModernButton, ModernTextInput, Text, Typewriter } from '@repo/ui';
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
            <S.Header>
              <Text variant="h2" weight="bold">
                {t('auth.login.title')}
              </Text>
              <Text variant="body" color="text.secondary">
                {t('auth.login.subtitle')}
              </Text>
            </S.Header>

            <S.Form onSubmit={handleSubmit(onSubmit)}>
              <ModernTextInput
                name="email"
                control={control}
                label={t('auth.login.emailLabel')}
                placeholder={t('auth.login.emailPlaceholder')}
                type="email"
                isDisabled={isLoading || isSubmitting}
                iconLeft="mail"
              />

              <ModernTextInput
                name="password"
                control={control}
                label={t('auth.login.passwordLabel')}
                placeholder={t('auth.login.passwordPlaceholder')}
                type="password"
                isDisabled={isLoading || isSubmitting}
                iconLeft="lock"
              />

              <S.ButtonContainer>
                <ModernButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  isLoading={isLoading || isSubmitting}
                  size="large"
                >
                  {t('auth.login.submitButton')}
                </ModernButton>
              </S.ButtonContainer>
            </S.Form>

            <S.Footer>
              <Text variant="body" color="text.secondary">
                {t('auth.login.noAccount')}
              </Text>
              <S.FooterLink type="button" onClick={onNavigateToRegister}>
                {t('auth.login.registerLink')}
              </S.FooterLink>
            </S.Footer>
          </S.AuthCard>
        </S.FormPanel>
      </S.LayoutWrapper>
    </S.Container>
  );
};
