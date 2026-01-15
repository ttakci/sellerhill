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

import { getErrorMessage } from '@/utils/errorHandler';
import { useRegisterMutation } from '../api/authApi';
import { RegisterPageComponent } from './RegisterPage.component';

export const RegisterPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage } = useUI();

  const [register, { isLoading, isSuccess, error }] = useRegisterMutation();

  // Use RTK Query loading state with useLoading hook
  useLoading(isLoading);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      // Success redirection handled in handleSubmit or via useEffect
    }
  }, [isSuccess]);

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
            labelKey: 'message.error.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [error, showMessage, closeMessage, t]);

  const handleSubmit = async (data: RegisterFormData): Promise<void> => {
    try {
      await register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      }).unwrap();

      // Redirect to check email page
      navigate(`/auth/check-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      // Error handled by useEffect
      console.error('Registration failed:', err);
    }
  };

  const handleNavigateToLogin = (): void => {
    navigate('/login');
  };

  return (
    <RegisterPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
};
