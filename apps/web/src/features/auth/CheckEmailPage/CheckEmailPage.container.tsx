/**
 * CheckEmailPage Container (Smart Component)
 */

import { useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation } from '../api/authApi';
import { CheckEmailPageComponent } from './CheckEmailPage.component';

export const CheckEmailPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showMessage } = useUI();

  const email = searchParams.get('email') || '';

  const [resend, { isLoading: isResending }] = useResendVerificationMutation();

  const handleResend = async (): Promise<void> => {
    if (!email) return;

    try {
      await resend({ email }).unwrap();
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

  const handleBackToLogin = (): void => {
    navigate('/login');
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
