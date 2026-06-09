/**
 * VerifyEmailPage Container
 */

import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation, useVerifyEmailMutation } from '../api/authApi';

import { VerifyEmailPageComponent } from './VerifyEmailPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const VerifyEmailPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation(['auth', 'translation']);
  const [searchParams] = useSearchParams();
  const { showMessage, closeMessage } = useUI();
  const { locale, localeNavigate } = useLocale();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [verifyEmail, { isLoading, isSuccess, error: verifyError }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending, isSuccess: resendSuccess, error: resendError }] =
    useResendVerificationMutation();

  useLoading(isLoading || isResending);

  const status = useMemo(() => {
    if (verifyError || (!token && !isLoading)) {return 'error';}
    if (isSuccess) {return 'success';}
    return 'loading';
  }, [verifyError, token, isLoading, isSuccess]);

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => localeNavigate('/login', { replace: true }), 2000);
    }
  }, [isSuccess, localeNavigate]);

  useEffect(() => {
    if (resendSuccess) {
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
  }, [resendSuccess, showMessage, closeMessage, i18n]);

  useEffect(() => {
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

  useEffect(() => {
    if (token) {void verifyEmail({ token });}
  }, [token, verifyEmail]);

  const handleResendVerification = (): void => {
    if (!email) {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'auth:auth.errors.userNotFound',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        i18n.t.bind(i18n)
      );
      return;
    }
    void resendVerification({ email, locale });
  };

  return (
    <VerifyEmailPageComponent
      status={status}
      email={email || undefined}
      onResendVerification={handleResendVerification}
      onNavigateToLogin={() => localeNavigate('/login')}
    />
  );
};
