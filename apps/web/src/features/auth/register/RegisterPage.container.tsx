/**
 * RegisterPage Container (Smart Component)
 *
 * Purpose: Handle registration logic and API calls
 */

import type { RegisterFormData, SupportedLocale } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useRegisterMutation } from '../api/authApi';

import { RegisterPageComponent } from './RegisterPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const RegisterPageContainer = (): React.ReactElement => {
  const { locale, localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [register, { isLoading, isSuccess, error }] = useRegisterMutation();
  const [submittedEmail, setSubmittedEmail] = React.useState<string>('');

  useLoading(isLoading);

  useEffect(() => {
    if (isSuccess && submittedEmail) {
      localeNavigate(`/auth/check-email?email=${encodeURIComponent(submittedEmail)}`);
    }
  }, [isSuccess, submittedEmail, localeNavigate]);

  useEffect(() => {
    if (!error) {return;}
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n)
    );
  }, [error, showMessage, closeMessage, i18n]);

  const handleSubmit = (data: RegisterFormData): void => {
    setSubmittedEmail(data.email);
    void register({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      locale: locale as SupportedLocale,
    });
  };

  const handleNavigateToLogin = (): void => {
    localeNavigate('/login');
  };

  return (
    <RegisterPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
};
