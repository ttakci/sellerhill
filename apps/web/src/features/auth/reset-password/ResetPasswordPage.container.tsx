/**
 * ResetPasswordPage Container (Smart Component)
 *
 * Reads the opaque token from the URL, drives the reset mutation, and picks the
 * form / success / error state. A completed reset issues no session — the user
 * is sent to the login screen after a short delay.
 */

import type { ResetPasswordFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useResetPasswordMutation } from '../api/authApi';

import { ResetPasswordPageComponent } from './ResetPasswordPage.component';
import type { ResetPasswordStatus } from './ResetPasswordPage.types';

import { getErrorI18nKey, isFetchBaseQueryError } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const REDIRECT_DELAY_MS = 2000;

export const ResetPasswordPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation(['auth', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const { localeNavigate } = useLocale();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [resetPassword, { isLoading, isSuccess, error }] = useResetPasswordMutation();

  useLoading(isLoading);

  /** A 401 means the token itself is bad — that belongs in the error panel. */
  const isTokenRejected = isFetchBaseQueryError(error) && error.status === 401;

  const status: ResetPasswordStatus = React.useMemo(() => {
    if (isSuccess) {
      return 'success';
    }
    if (!token || isTokenRejected) {
      return 'error';
    }
    return 'form';
  }, [isSuccess, token, isTokenRejected]);

  React.useEffect(() => {
    if (!isSuccess) {
      return;
    }
    const id = setTimeout(() => localeNavigate('/login', { replace: true }), REDIRECT_DELAY_MS);
    return () => clearTimeout(id);
  }, [isSuccess, localeNavigate]);

  // Non-token errors (e.g. new password equals the old one, throttling) keep the
  // form up and surface the reason in a modal so the user can correct and retry.
  React.useEffect(() => {
    if (!error || isTokenRejected) {
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
  }, [error, isTokenRejected, showMessage, closeMessage, i18n]);

  const handleSubmit = (data: ResetPasswordFormData): void => {
    if (!token) {
      return;
    }
    void resetPassword({ token, password: data.password });
  };

  return (
    <ResetPasswordPageComponent
      status={status}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onRequestNewLink={() => localeNavigate('/forgot-password')}
      onNavigateToLogin={() => localeNavigate('/login')}
    />
  );
};

export default ResetPasswordPageContainer;
