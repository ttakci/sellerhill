/**
 * CheckEmailPage Container (Smart Component)
 */

import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation } from '../api/authApi';

import { CheckEmailPageComponent } from './CheckEmailPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const CheckEmailPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation(['auth', 'translation']);
  const [searchParams] = useSearchParams();
  const { showMessage, closeMessage } = useUI();
  const { locale, localeNavigate } = useLocale();

  const email = searchParams.get('email') || '';

  const [resend, { isLoading: isResending, isSuccess, error: resendError }] = useResendVerificationMutation();

  useLoading(isResending);

  // Handle success
  React.useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'auth:auth.verification.resent',
          primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
        },
        i18n.t.bind(i18n)
      );
    }
  }, [isSuccess, showMessage, closeMessage, i18n]);

  // Handle error
  React.useEffect(() => {
    if (!resendError) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(resendError),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n)
    );
  }, [resendError, showMessage, closeMessage, i18n]);

  const handleResend = (): void => {
    if (!email) {
      return;
    }
    void resend({ email, locale });
  };

  const handleBackToLogin = (): void => {
    localeNavigate('/login');
  };

  return (
    <CheckEmailPageComponent
      email={email}
      onResend={handleResend}
      onBackToLogin={handleBackToLogin}
      isResending={isResending}
    />
  );
};

export default CheckEmailPageContainer;
