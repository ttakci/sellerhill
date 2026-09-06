import { AUTH_CONSTANTS } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { ChangePasswordDrawerComponent } from './ChangePasswordDrawer.component';
import type { ChangePasswordDrawerProps } from './ChangePasswordDrawer.types';

import { useChangePasswordMutation } from '@/features/auth/api/authApi';

export const ChangePasswordDrawer: React.FC<ChangePasswordDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback((): void => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const validate = useCallback((): string | null => {
    if (!current || !next || !confirm) {
      return t('translation:validation.required');
    }
    if (next.length < AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) {
      return t('translation:settingsHub.drawer.password.tooShort');
    }
    if (next !== confirm) {
      return t('translation:settingsHub.drawer.password.mismatch');
    }
    if (next === current) {
      return t('translation:settingsHub.drawer.password.sameAsCurrent');
    }
    return null;
  }, [current, next, confirm, t]);

  const handleSubmit = useCallback((): void => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    void changePassword({ currentPassword: current, newPassword: next })
      .unwrap()
      .then(() => {
        reset();
        notifyDrawerDone({
          onClose,
          showMessage,
          closeMessage,
          t,
          headerKey: 'translation:settingsHub.drawer.password.successHeader',
          descriptionKey: 'translation:settingsHub.drawer.password.successDescription',
        });
      })
      .catch(() => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'translation:error.serverError',
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t
        );
      });
  }, [validate, changePassword, current, next, reset, onClose, showMessage, closeMessage, t]);

  return (
    <ChangePasswordDrawerComponent
      isOpen={isOpen}
      onClose={handleClose}
      currentPassword={current}
      newPassword={next}
      confirmPassword={confirm}
      error={error}
      isSaving={isLoading}
      onCurrentPasswordChange={(e) => setCurrent(e.target.value)}
      onNewPasswordChange={(e) => setNext(e.target.value)}
      onConfirmPasswordChange={(e) => setConfirm(e.target.value)}
      onSubmit={handleSubmit}
    />
  );
};

ChangePasswordDrawer.displayName = 'ChangePasswordDrawer';
