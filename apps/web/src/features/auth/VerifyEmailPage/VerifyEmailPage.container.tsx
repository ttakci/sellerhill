/**
 * VerifyEmailPage Container
 */

import { useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation, useVerifyEmailMutation } from '../api/authApi';
import { VerifyEmailPageComponent } from './VerifyEmailPage.component';

export const VerifyEmailPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showMessage } = useUI();
  
  const token = searchParams.get('token');
  const email = searchParams.get('email'); // Optional, mainly for display

  const [verifyEmail, { isLoading, isSuccess, isError }] = useVerifyEmailMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setStatus('error');
        return;
      }

      try {
        await verifyEmail({ token }).unwrap();
        
        setStatus('success');
        
        // Redirect to login page after success
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } catch (err) {
        setStatus('error');
      }
    };

    performVerification();
  }, [token, verifyEmail]);

  const handleResendVerification = async () => {
    if (!email) {
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: 'auth.errors.userNotFound',
      }, t);
      return;
    }

    try {
      await resendVerification({ email }).unwrap();
      showMessage({
        type: 'success',
        headerKey: 'message.success.header',
        descriptionKey: 'auth.verification.resent',
      }, t);
    } catch (err) {
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: 'auth.errors.verificationFailed',
      }, t);
    }
  };

  const handleNavigateToLogin = () => {
    navigate('/login');
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
