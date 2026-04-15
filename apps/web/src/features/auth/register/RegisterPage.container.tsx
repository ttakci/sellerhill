/**
 * RegisterPage Container (Smart Component)
 *
 * Purpose: Handle registration logic and API calls
 */

import type { RegisterFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useRegisterMutation } from '../api/authApi';

import { RegisterPageComponent } from './RegisterPage.component';

import { getErrorMessage } from '@/utils/errorHandler';

export const RegisterPageContainer = (): React.ReactElement => {
  const { t } = useTranslation(['auth', 'translation']);
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const [register, { isLoading, isSuccess, error }] = useRegisterMutation();
  const [submittedEmail, setSubmittedEmail] = React.useState<string>('');

  // Use RTK Query loading state with useLoading hook
  useLoading(isLoading);

  // Handle success
  useEffect(() => {
    if (isSuccess && submittedEmail) {
      // Redirect to check email page
      void navigate(`/auth/check-email?email=${encodeURIComponent(submittedEmail)}`);
    }
  }, [isSuccess, submittedEmail, navigate]);
  // Handle error
  useEffect(() => {
    if (error) {
      const { key, params } = getErrorMessage(error);
      showMessage(
        {
          type: 'error',
          headerKey: 'message.error.header',
          descriptionKey: key,
          descriptionParams: params,
          primaryButton: {
            labelKey: 'translation:message.error.close',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [error, showMessage, closeMessage, t]);

  const handleSubmit = (data: RegisterFormData): void => {
    setSubmittedEmail(data.email);
    void register({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
    });
  };

  const handleNavigateToLogin = (): void => {
    void navigate('/login');
  };

  return (
    <RegisterPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
};
