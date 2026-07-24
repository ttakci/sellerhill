/**
 * RegisterPage Container (Smart Component)
 *
 * Purpose: Handle registration logic and API calls (password + Google).
 *
 * Split into WithGoogle / PasswordOnly because the GIS `useGoogleLogin` hook
 * MUST NOT be called when GoogleOAuthProvider is absent (no client id) — it
 * throws. Password register still routes to check-email; Google register does
 * NOT (it logs in immediately).
 */

import { useGoogleLogin as useGoogleOAuth } from '@react-oauth/google';
import type { RegisterFormData, SupportedLocale } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useGoogleLoginMutation, useRegisterMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';

import { RegisterPageComponent } from './RegisterPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

function showErrorModal(
  err: Parameters<typeof getErrorI18nKey>[0],
  showMessage: ReturnType<typeof useUI>['showMessage'],
  closeMessage: ReturnType<typeof useUI>['closeMessage'],
  i18n: ReturnType<typeof useTranslation>['i18n']
): void {
  const key = getErrorI18nKey(err);
  showMessage(
    {
      type: 'error',
      headerKey: 'translation:message.error.header',
      descriptionKey: key,
      primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
    },
    i18n.t.bind(i18n)
  );
}

function navigateAfterAuth(
  user: { hasConnectedAccounts: boolean },
  localeNavigate: (path: string) => void
): void {
  if (user.hasConnectedAccounts) {
    localeNavigate('/dashboard');
  } else {
    localeNavigate('/onboarding/ebay');
  }
}

/** Password-only branch (no GoogleOAuthProvider mounted). */
const RegisterPageContainerPasswordOnly = (): React.ReactElement => {
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
    if (!error) {
      return;
    }
    showErrorModal(error, showMessage, closeMessage, i18n);
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
      onGoogleSignIn={(): void => undefined}
      isGoogleLoading={false}
      googleEnabled={false}
    />
  );
};

/** Google-enabled branch. Calls useGoogleOAuth (provider present). */
const RegisterPageContainerWithGoogle = (): React.ReactElement => {
  const dispatch = useDispatch();
  const { locale, localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [register, { isLoading, isSuccess, error }] = useRegisterMutation();
  const [submittedEmail, setSubmittedEmail] = React.useState<string>('');
  const [
    googleLogin,
    { isLoading: isGoogleLoading, isSuccess: isGoogleSuccess, error: googleError, data: googleData },
  ] = useGoogleLoginMutation();

  useLoading(isLoading || isGoogleLoading);

  useEffect(() => {
    if (isSuccess && submittedEmail) {
      localeNavigate(`/auth/check-email?email=${encodeURIComponent(submittedEmail)}`);
    }
  }, [isSuccess, submittedEmail, localeNavigate]);

  useEffect(() => {
    if (isGoogleSuccess && googleData) {
      dispatch(setCredentials(googleData));
      navigateAfterAuth(googleData.user, localeNavigate);
    }
  }, [isGoogleSuccess, googleData, dispatch, localeNavigate]);

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorModal(error, showMessage, closeMessage, i18n);
  }, [error, showMessage, closeMessage, i18n]);

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

  const handleGoogleSignIn = (): void => {
    startGoogleOAuth();
  };

  return (
    <RegisterPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToLogin={handleNavigateToLogin}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      googleEnabled
    />
  );
};

export const RegisterPageContainer = (): React.ReactElement => {
  if (!googleClientId) {
    return <RegisterPageContainerPasswordOnly />;
  }
  return <RegisterPageContainerWithGoogle />;
};
