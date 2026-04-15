/**
 * CheckEmailPage Container (Smart Component)
 */

import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useResendVerificationMutation } from '../api/authApi';

import { CheckEmailPageComponent } from './CheckEmailPage.component';

export const CheckEmailPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showMessage } = useUI();

  const email = searchParams.get('email') || '';

  const [resend, { isLoading: isResending, isSuccess, isError }] = useResendVerificationMutation();

  useLoading(isResending);

  // Handle success
  React.useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'message.success.header',
          descriptionKey: 'auth.verification.resent',
        },
        t
      );
    }
  }, [isSuccess, showMessage, t]);

  // Handle error
  React.useEffect(() => {
    if (isError) {
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: 'auth.errors.verificationFailed',
        },
        t
      );
    }
  }, [isError, showMessage, t]);

  const handleResend = (): void => {
    if (!email) {return;}
    void resend({ email });
  };

  const handleBackToLogin = (): void => {
    void navigate('/login');
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
