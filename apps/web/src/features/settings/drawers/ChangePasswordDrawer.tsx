import { AUTH_CONSTANTS } from '@repo/shared';
import {
  Drawer,
  ModernTextInput,
  useUI,
} from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BodyStack,
  ErrorText,
} from './ChangePasswordDrawer.style';
import type { ChangePasswordDrawerProps } from './ChangePasswordDrawer.types';

import { useChangePasswordMutation } from '@/features/auth/api/authApi';


export const ChangePasswordDrawer: React.FC<ChangePasswordDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const validate = (): string | null => {
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
  };

  const handleSubmit = (): void => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void changePassword({ currentPassword: current, newPassword: next })
      .unwrap()
      .then(() => {
        reset();
        onClose();
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:settingsHub.drawer.password.successHeader',
            descriptionKey: 'translation:settingsHub.drawer.password.successDescription',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
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
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={t('translation:settingsHub.drawer.password.title')}
      subtitle={t('translation:settingsHub.drawer.password.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: handleSubmit,
        isLoading: !!isLoading,
      }}
    >
      <BodyStack>
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.current')}
          value={current}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCurrent(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.new')}
          value={next}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNext(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.confirm')}
          value={confirm}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setConfirm(e.target.value)
          }
        />
        {error && <ErrorText variant="caption">{error}</ErrorText>}
      </BodyStack>
    </Drawer>
  );
};
