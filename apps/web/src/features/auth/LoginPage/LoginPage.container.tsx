/**
 * LoginPage Container (Smart Component)
 *
 * Purpose: Handle login logic and API calls
 */

import type { LoginFormData } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getErrorMessage } from '@/utils/errorHandler';
import { useLoginMutation } from '../api/authApi';
import { LoginPageComponent } from './LoginPage.component';

export const LoginPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showMessage, closeMessage, showLoading, hideLoading } = useUI();

  const [login, { isLoading, isSuccess, error }] = useLoginMutation();

  // Handle loading state
  useEffect(() => {
    if (isLoading) {
      showLoading({ overlay: true });
    } else {
      hideLoading();
    }
  }, [isLoading, showLoading, hideLoading]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'message.success.header',
          descriptionKey: 'auth.login.successMessage',
          primaryButton: {
            labelKey: 'message.success.ok',
            onClick: () => {
              closeMessage();
              navigate('/dashboard');
            },
          },
        },
        t
      );
    }
  }, [isSuccess, showMessage, closeMessage, navigate, t]);

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

  const handleSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      const result = await login({
        email: data.email,
        password: data.password,
      }).unwrap();

      // Store tokens
      localStorage.setItem('accessToken', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
      localStorage.setItem('user', JSON.stringify(result.user));
    } catch (err) {
      // Error handled by useEffect
      console.error('Login failed:', err);
    }
  };

  const handleNavigateToRegister = (): void => {
    navigate('/register');
  };

  return (
    <LoginPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToRegister={handleNavigateToRegister}
    />
  );
};
