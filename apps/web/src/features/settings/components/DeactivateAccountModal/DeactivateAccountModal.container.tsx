import { useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { DeactivateAccountModalComponent } from './DeactivateAccountModal.component';
import type { DeactivateAccountModalProps } from './DeactivateAccountModal.types';

import { baseApi } from '@/api/baseApi';
import { useDeactivateAccountMutation, useGetMeQuery } from '@/features/auth/api/authApi';
import { logout } from '@/features/auth/store/authSlice';
import { useLocale } from '@/utils/useLocale';

export const DeactivateAccountModal: React.FC<DeactivateAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const dispatch = useDispatch();
  const { localeNavigate } = useLocale();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [deactivate, { isLoading }] = useDeactivateAccountMutation();
  const { data: user } = useGetMeQuery();
  const [confirmInput, setConfirmInput] = useState('');

  const userEmail = user?.email ?? '';

  const handleClose = (): void => {
    setConfirmInput('');
    onClose();
  };

  const handleConfirm = (): void => {
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void deactivate()
      .unwrap()
      .then(() => {
        setConfirmInput('');
        onClose();
        dispatch(baseApi.util.resetApiState());
        dispatch(logout());
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:settingsHub.modal.deactivate.successHeader',
            descriptionKey: 'translation:settingsHub.modal.deactivate.successDescription',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
        localeNavigate('/login');
      })
      .catch(() => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'translation:error.serverError',
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <DeactivateAccountModalComponent
      isOpen={isOpen}
      onClose={handleClose}
      userEmail={userEmail}
      confirmInput={confirmInput}
      onConfirmInputChange={setConfirmInput}
      onConfirm={handleConfirm}
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      isLoading={isLoading}
    />
  );
};
