/**
 * LoginPage Container (Smart Component)
 *
 * Purpose: Handle login logic and API calls
 */

import type { LoginFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { getErrorMessage } from '@/utils/errorHandler';
import { useDispatch } from 'react-redux';
import { useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';
import { LoginPageComponent } from './LoginPage.component';

export const LoginPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showMessage, closeMessage } = useUI();

  const [login, { isLoading, isSuccess, error }] = useLoginMutation();

  // Use RTK Query loading state with useLoading hook
  useLoading(isLoading);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      // Navigation is now handled in handleSubmit after token storage
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

  const handleSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      const result = await login({
        email: data.email,
        password: data.password,
      }).unwrap();

      // Store credentials in Redux (which also syncs to localStorage)
      dispatch(setCredentials(result));

      // Redirect based on whether user has connected accounts
      if (result.user.hasConnectedAccounts) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding/ebay');
      }
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
