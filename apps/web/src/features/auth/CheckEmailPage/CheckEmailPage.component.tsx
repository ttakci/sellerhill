/**
 * CheckEmailPage Component (Presentation)
 */

import { Button, Icon, Text } from '@repo/ui';
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
      <S.AuthCard>
        <S.IconCircle>
          <Icon name="inbox" size={40} />
        </S.IconCircle>

        <Text variant="h2" weight="bold" color="text.primary">
          {t('auth.verification.checkEmail.title')}
        </Text>
        
        <S.DescriptionWrapper>
          <Text variant="body" color="text.secondary">
            {t('auth.verification.checkEmail.description', { email })}
          </Text>
        </S.DescriptionWrapper>

        <S.ActionGroup>
          <Button
            variant="secondary"
            onClick={onBackToLogin}
            fullWidth
          >
            {t('auth.verification.checkEmail.backToLogin')}
          </Button>
        </S.ActionGroup>

        <S.Footer>
          {t('auth.verification.checkEmail.resendInfo')}{' '}
          <S.TextButton onClick={onResend} disabled={isResending}>
            {isResending ? t('auth.verification.resending') : t('auth.verification.checkEmail.resendButton')}
          </S.TextButton>
        </S.Footer>
      </S.AuthCard>
    </S.Container>
  );
};
