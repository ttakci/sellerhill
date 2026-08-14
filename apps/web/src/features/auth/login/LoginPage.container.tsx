/**
 * LoginPage Container (Smart Component)
 *
 * Purpose: Handle login logic and API calls (password + Google).
 *
 * Split into WithGoogle / PasswordOnly because the GIS `useGoogleLogin` hook
 * MUST NOT be called when GoogleOAuthProvider is absent (no client id) — it
 * throws. Each branch keeps the same password path.
 */

import { useGoogleLogin as useGoogleOAuth } from '@react-oauth/google';
import type { LoginFormData, SupportedLocale, UserRole } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useGoogleLoginMutation, useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';

import { useLoginErrorModal } from './hooks/useLoginErrorModal';
import { LoginPageComponent } from './LoginPage.component';

import { resolveHomePath } from '@/app/operatorRouting';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

/** Renders pre-translated error strings via the fake-t adapter MessageModal uses. */
function showErrorModal(
  err: Parameters<typeof getErrorI18nKey>[0],
  showMessage: ReturnType<typeof useUI>['showMessage'],
  closeMessage: ReturnType<typeof useUI>['closeMessage'],
  i18n: ReturnType<typeof useTranslation>['i18n']
): void {
  const key = getErrorI18nKey(err);
  const header = i18n.t('translation:message.error.header');
  const description = i18n.t(key);
  const closeLabel = i18n.t('translation:message.error.close');

  const translations: Record<string, string> = {
    'translation:message.error.header': header,
    'translation:message.error.close': closeLabel,
    [key]: description,
  };
  const fakeT = (k: string): string => translations[k] ?? k;

  showMessage(
    {
      type: 'error',
      headerKey: 'translation:message.error.header',
      descriptionKey: key,
      primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
    },
    fakeT
  );
}

/** Staff land in the operator console, sellers in their own app. */
function navigateAfterAuth(
  user: { hasConnectedAccounts: boolean; role?: UserRole },
  localeNavigate: (path: string) => void
): void {
  localeNavigate(resolveHomePath(user.role, user.hasConnectedAccounts));
}

/** Password-only branch (no GoogleOAuthProvider mounted). */
const LoginPageContainerPasswordOnly = (): React.ReactElement => {
  const dispatch = useDispatch();
  const { localeNavigate } = useLocale();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const [login, { isLoading, isSuccess, error, data }] = useLoginMutation();

  useLoading(isLoading);

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setCredentials(data));
      navigateAfterAuth(data.user, localeNavigate);
    }
  }, [isSuccess, data, dispatch, localeNavigate]);

  useLoginErrorModal(error, submittedEmail);

  const handleSubmit = (formData: LoginFormData): void => {
    setSubmittedEmail(formData.email);
    void login({ email: formData.email, password: formData.password });
  };

  const handleNavigateToRegister = (): void => {
    localeNavigate('/register');
  };

  return (
    <LoginPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToRegister={handleNavigateToRegister}
      onGoogleSignIn={(): void => undefined}
      isGoogleLoading={false}
      googleEnabled={false}
    />
  );
};

/** Google-enabled branch. Calls useGoogleOAuth (provider present). */
const LoginPageContainerWithGoogle = (): React.ReactElement => {
  const dispatch = useDispatch();
  const { locale, localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const [login, { isLoading, isSuccess, error, data }] = useLoginMutation();
  const [
    googleLogin,
    { isLoading: isGoogleLoading, isSuccess: isGoogleSuccess, error: googleError, data: googleData },
  ] = useGoogleLoginMutation();

  useLoading(isLoading || isGoogleLoading);

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setCredentials(data));
      navigateAfterAuth(data.user, localeNavigate);
    }
  }, [isSuccess, data, dispatch, localeNavigate]);

  useEffect(() => {
    if (isGoogleSuccess && googleData) {
      dispatch(setCredentials(googleData));
      navigateAfterAuth(googleData.user, localeNavigate);
    }
  }, [isGoogleSuccess, googleData, dispatch, localeNavigate]);

  useLoginErrorModal(error, submittedEmail);

  useEffect(() => {
    if (!googleError) {
      return;
    }
    showErrorModal(googleError, showMessage, closeMessage, i18n);
  }, [googleError, showMessage, closeMessage, i18n]);

  const startGoogleOAuth = useGoogleOAuth({
    flow: 'auth-code',
    onSuccess: (res): void => {
      void googleLogin({ code: res.code, locale: locale as SupportedLocale });
    },
    onError: (): void => {
      const translations: Record<string, string> = {
        'translation:message.error.header': i18n.t('translation:message.error.header'),
        'translation:message.error.close': i18n.t('translation:message.error.close'),
        'auth:auth.errors.googlePopupClosed': i18n.t('auth:auth.errors.googlePopupClosed'),
      };
      const fakeT = (k: string): string => translations[k] ?? k;
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'auth:auth.errors.googlePopupClosed',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        fakeT
      );
    },
  });

  const handleSubmit = (formData: LoginFormData): void => {
    setSubmittedEmail(formData.email);
    void login({ email: formData.email, password: formData.password });
  };

  const handleNavigateToRegister = (): void => {
    localeNavigate('/register');
  };

  const handleGoogleSignIn = (): void => {
    startGoogleOAuth();
  };

  return (
    <LoginPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToRegister={handleNavigateToRegister}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      googleEnabled
    />
  );
};

export const LoginPageContainer = (): React.ReactElement => {
  if (!googleClientId) {
    return <LoginPageContainerPasswordOnly />;
  }
  return <LoginPageContainerWithGoogle />;
};
