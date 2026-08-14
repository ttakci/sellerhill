/**
 * useLoginErrorModal
 *
 * Purpose: Show the login error modal, with a "Resend" secondary action for
 * the emailNotVerified case — the backend rejects login before we know
 * whether the original verification email actually arrived, so the seller
 * needs a way to trigger a new one from the same modal instead of hunting
 * for a resend link elsewhere.
 */

import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useUI } from '@repo/ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useResendVerificationMutation } from '../../api/authApi';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const EMAIL_NOT_VERIFIED_KEY = 'auth:auth.errors.emailNotVerified';

export function useLoginErrorModal(
  error: FetchBaseQueryError | SerializedError | undefined,
  submittedEmail: string | null
): void {
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();
  const { locale } = useLocale();
  const [resendVerification, { isSuccess: resendSuccess, error: resendError }] = useResendVerificationMutation();
  const t = i18n.t.bind(i18n);

  useEffect(() => {
    if (!error) {
      return;
    }

    const key = getErrorI18nKey(error);

    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: key,
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        secondaryButton:
          key === EMAIL_NOT_VERIFIED_KEY && submittedEmail
            ? {
                labelKey: 'auth:auth.checkEmail.resendLink',
                onClick: (): void => void resendVerification({ email: submittedEmail, locale }),
              }
            : undefined,
      },
      t
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (!resendSuccess) {
      return;
    }
    showMessage(
      {
        type: 'success',
        headerKey: 'translation:message.success.header',
        descriptionKey: 'auth:auth.verification.resent',
        primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
      },
      t
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendSuccess]);

  useEffect(() => {
    if (!resendError) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(resendError),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resendError]);
}
