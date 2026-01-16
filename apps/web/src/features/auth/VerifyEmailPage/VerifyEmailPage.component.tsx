/**
 * VerifyEmailPage Component (Presentation)
 */

import { Button, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './VerifyEmailPage.style';
import type { VerifyEmailPageProps } from './VerifyEmailPage.types';

export const VerifyEmailPageComponent = ({
  status,
  onResendVerification,
  onNavigateToLogin,
}: VerifyEmailPageProps): React.ReactElement => {
  const { t } = useTranslation();

  const getStatusContent = () => {
    switch (status) {
      case 'loading':
        return {
          icon: 'calendar' as const, // Placeholder for loading icon if no spinner atom
          title: t('auth.verification.verifying'),
          description: t('common.loading'),
          type: 'loading' as const,
        };
      case 'success':
        return {
          icon: 'inbox' as const,
          title: t('auth.verification.success'),
          description: t('auth.verification.verified'),
          type: 'success' as const,
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          title: t('auth.verification.title'),
          description: t('auth.errors.verificationFailed'),
          type: 'error' as const,
        };
    }
  };

  const content = getStatusContent();

  return (
    <S.Container>
      <S.AuthCard>
        <S.StatusIconWrapper $type={content.type}>
          <Icon name={content.icon} size={40} />
        </S.StatusIconWrapper>

        <Text variant="h2" weight="bold" color="text.primary">
          {content.title}
        </Text>
        
        <S.Description>
          <Text variant="body" color="text.secondary">
            {content.description}
          </Text>
        </S.Description>

        <S.ActionGroup>
          {status === 'success' && (
            <Button onClick={onNavigateToLogin} variant="primary" fullWidth>
              {t('auth.login.submitButton')}
            </Button>
          )}

          {status === 'error' && (
            <>
              <Button onClick={() => window.location.reload()} variant="primary" fullWidth>
                {t('common.retry')}
              </Button>
              <Button onClick={onNavigateToLogin} variant="secondary" fullWidth>
                {t('auth.login.submitButton')}
              </Button>
              <S.ResendButton onClick={onResendVerification}>
                {t('auth.verification.resendButton')}
              </S.ResendButton>
            </>
          )}

          {status === 'loading' && (
             <Text variant="caption" color="text.disabled">Please wait while we confirm your account...</Text>
          )}
        </S.ActionGroup>

        {status === 'success' && (
           <S.Footer>
             <Text variant="caption" color="text.tertiary">
               Welcome to the Zonds community! 🚀
             </Text>
           </S.Footer>
        )}
      </S.AuthCard>
    </S.Container>
  );
};
