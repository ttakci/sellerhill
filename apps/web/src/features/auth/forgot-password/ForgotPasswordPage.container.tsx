/**
 * ForgotPasswordPage Container (Smart Component)
 *
 * Owns the request mutation and the local "submitted" flip. The response is
 * deliberately identical whether or not an account exists, so success only
 * means "request accepted".
 */

import type { ForgotPasswordFormData, SupportedLocale } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useForgotPasswordMutation } from '../api/authApi';

import { ForgotPasswordPageComponent } from './ForgotPasswordPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

export const ForgotPasswordPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation(['auth', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const { locale, localeNavigate } = useLocale();

  const [submittedEmail, setSubmittedEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const [forgotPassword, { isLoading, isSuccess, error }] = useForgotPasswordMutation();

  useLoading(isLoading);

  React.useEffect(() => {
    if (isSuccess) {
      setSubmitted(true);
    }
  }, [isSuccess]);

  React.useEffect(() => {
    if (!error) {
      return;
    }
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

  const handleSubmit = (data: ForgotPasswordFormData): void => {
    setSubmittedEmail(data.email);
    void forgotPassword({ email: data.email, locale: locale as SupportedLocale });
  };

  const handleResend = (): void => {
    if (!submittedEmail) {
      return;
    }
    void forgotPassword({ email: submittedEmail, locale: locale as SupportedLocale });
  };

  return (
    <ForgotPasswordPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitted={submitted}
      submittedEmail={submittedEmail}
      onResend={handleResend}
      onBackToLogin={() => localeNavigate('/login')}
    />
  );
};

export default ForgotPasswordPageContainer;
