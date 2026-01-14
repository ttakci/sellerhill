/**
 * VerifyEmailPage Dumb Component
 */

import { Button, Icon } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './VerifyEmailPage.style';
import type { VerifyEmailPageProps } from './VerifyEmailPage.types';

export const VerifyEmailPageComponent = ({
  status,
  email,
  onResendVerification,
  onNavigateToLogin,
}: VerifyEmailPageProps): React.ReactElement => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Card>
        <S.IconWrapper 
          success={status === 'success'} 
          error={status === 'error'}
        >
          <Icon 
            name={
              status === 'loading' ? 'calendar' : // Use calendar as placeholder for loader/clock
              status === 'success' ? 'inbox' : 
              'alert-circle'
            } 
            size={32} 
          />
        </S.IconWrapper>

        {status === 'loading' && (
          <>
            <S.Title>{t('auth.verification.verifying')}</S.Title>
            <S.Description>{t('common.loading')}</S.Description>
          </>
        )}

        {status === 'success' && (
          <>
            <S.Title>{t('auth.verification.success')}</S.Title>
            <S.Description>{t('auth.verification.verified')}</S.Description>
            <S.Footer>
              <Button onClick={onNavigateToLogin} variant="primary">
                {t('auth.login.submitButton')}
              </Button>
            </S.Footer>
          </>
        )}

        {status === 'error' && (
          <>
            <S.Title>{t('auth.verification.title')}</S.Title>
            <S.Description>{t('auth.errors.verificationFailed')}</S.Description>
            <S.Footer>
              <Button onClick={() => window.location.reload()} variant="primary">
                {t('common.retry')}
              </Button>
              <Button onClick={onResendVerification} variant="secondary">
                {t('auth.verification.resendButton')}
              </Button>
              <Button onClick={onNavigateToLogin} variant="secondary">
                {t('auth.login.submitButton')}
              </Button>
            </S.Footer>
          </>
        )}
      </S.Card>
    </S.Container>
  );
};
