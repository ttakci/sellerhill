/**
 * VerifyEmailPage Container
 */

import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation, useVerifyEmailMutation } from '../api/authApi';

import { VerifyEmailPageComponent } from './VerifyEmailPage.component';

import { getErrorMessage } from '@/utils/errorHandler';

export const VerifyEmailPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showMessage, closeMessage } = useUI();

  const token = searchParams.get('token');
  const email = searchParams.get('email'); // Optional, mainly for display

  const [verifyEmail, { isLoading, isSuccess, error: verifyError }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending, isSuccess: resendSuccess, error: resendError }] = useResendVerificationMutation();

  // Use RTK Query loading states with useLoading hook
  useLoading(isLoading || isResending);

  // Derive status from query state instead of using setState in effects
  const status = useMemo(() => {
    if (verifyError || (!token && !isLoading)) {
      return 'error';
    }
    if (isSuccess) {
      return 'success';
    }
    return 'loading';
  }, [verifyError, token, isLoading, isSuccess]);

  // Handle verification success - redirect to login
  useEffect(() => {
    if (isSuccess) {
      // Redirect to login page after success
      setTimeout(() => {
        void navigate('/login', { replace: true });
      }, 2000);
    }
  }, [isSuccess, navigate]);

  // Handle resend success
  useEffect(() => {
    if (resendSuccess) {
      showMessage({
        type: 'success',
        headerKey: 'message.success.header',
        descriptionKey: 'auth.verification.resent',
        primaryButton: {
          labelKey: 'message.success.ok',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [resendSuccess, showMessage, closeMessage, t]);

  // Handle resend error
  useEffect(() => {
    if (resendError) {
      const { key, params } = getErrorMessage(resendError);
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: key,
        descriptionParams: params,
        primaryButton: {
          labelKey: 'message.error.close',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [resendError, showMessage, closeMessage, t]);

  useEffect(() => {
    const performVerification = (): void => {
      if (!token) {
        return;
      }

      void verifyEmail({ token });
    };

    performVerification();
  }, [token, verifyEmail]);

  const handleResendVerification = (): void => {
    if (!email) {
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: 'auth.errors.userNotFound',
        primaryButton: {
          labelKey: 'message.error.close',
          onClick: closeMessage,
        },
      }, t);
      return;
    }

    void resendVerification({ email });
  };

  const handleNavigateToLogin = () => {
    void navigate('/login');
  };

  return (
    <VerifyEmailPageComponent
      status={status}
      email={email || undefined}
      onResendVerification={handleResendVerification}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
};
