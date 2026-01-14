/**
 * CheckEmailPage Component (Dumb Component)
 */

import { Button, Icon } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CheckEmailPage.style';
import type { CheckEmailPageProps } from './CheckEmailPage.types';

export const CheckEmailPageComponent: React.FC<CheckEmailPageProps> = ({
  email,
  onResend,
  onBackToLogin,
  isResending,
}) => {
  const { t } = useTranslation();

  return (
    <S.Container>
      <S.Card>
        <S.IconWrapper>
          <Icon name="inbox" size={40} />
        </S.IconWrapper>

        <S.Title>{t('auth.verification.checkEmail.title')}</S.Title>
        
        <S.Description>
          {t('auth.verification.checkEmail.description', { email })}
        </S.Description>

        <S.ActionContainer>
          <Button
            variant="secondary"
            onClick={onBackToLogin}
            fullWidth
          >
            {t('auth.verification.checkEmail.backToLogin')}
          </Button>
        </S.ActionContainer>

        <S.ResendText>
          {t('auth.verification.checkEmail.resendInfo')}{' '}
          <S.TextButton onClick={onResend} disabled={isResending}>
            {isResending ? t('auth.verification.resending') : t('auth.verification.checkEmail.resendButton')}
          </S.TextButton>
        </S.ResendText>
      </S.Card>
    </S.Container>
  );
};
