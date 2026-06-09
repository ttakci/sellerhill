/**
 * LoginPage Container (Smart Component)
 *
 * Purpose: Handle login logic and API calls
 */

import type { LoginFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';

import { LoginPageComponent } from './LoginPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const LoginPageContainer = (): React.ReactElement => {
  const dispatch = useDispatch();
  const { localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [login, { isLoading, isSuccess, error, data }] = useLoginMutation();

  useLoading(isLoading);

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setCredentials(data));
      if (data.user.hasConnectedAccounts) {
        localeNavigate('/dashboard');
      } else {
        localeNavigate('/onboarding/ebay');
      }
    }
  }, [isSuccess, data, dispatch, localeNavigate]);

  useEffect(() => {
    if (!error) {return;}
    const key = getErrorI18nKey(error);
    const header = i18n.t('translation:message.error.header');
    const description = i18n.t(key);
    const closeLabel = i18n.t('translation:message.error.close');

    // Pass pre-translated strings via fake t function
    const translations: Record<string, string> = {
      'translation:message.error.header': header,
      'translation:message.error.close': closeLabel,
      [key]: description,
    };
    const fakeT = (k: string) => translations[k] ?? k;

    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: key,
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      fakeT
    );
  }, [error, showMessage, closeMessage, i18n]);

  const handleSubmit = (data: LoginFormData): void => {
    void login({ email: data.email, password: data.password });
  };

  const handleNavigateToRegister = (): void => {
    localeNavigate('/register');
  };

  return (
    <LoginPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToRegister={handleNavigateToRegister}
    />
  );
};
