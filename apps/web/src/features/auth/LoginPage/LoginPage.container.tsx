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
  const { t } = useTranslation(['auth', 'translation']);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showMessage, closeMessage } = useUI();

  const [login, { isLoading, isSuccess, error, data }] = useLoginMutation();

  // Use RTK Query loading state with useLoading hook
  useLoading(isLoading);

  // Handle success
  useEffect(() => {
    if (isSuccess && data) {
      // Store credentials in Redux (which also syncs to localStorage)
      dispatch(setCredentials(data));

      // Redirect based on whether user has connected accounts
      if (data.user.hasConnectedAccounts) {
        navigate('/dashboard');
      } else {
        navigate('/onboarding/ebay');
      }
    }
  }, [isSuccess, data, dispatch, navigate]);

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

  const handleSubmit = (data: LoginFormData): void => {
    void login({
      email: data.email,
      password: data.password,
    });
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
