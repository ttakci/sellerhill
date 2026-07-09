import type { CreateAmazonAccountFormData } from '@repo/shared';
import { Drawer, ModernTextInput, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack } from './AmazonAccountDrawer.style';
import type { AmazonAccountDrawerProps } from './AmazonAccountDrawer.types';

import { useCreateAmazonAccountMutation } from '@/features/amazon/api/amazon.api';

export const AmazonAccountDrawer: React.FC<AmazonAccountDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [createAccount, { isLoading }] = useCreateAmazonAccountMutation();

  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');

  const handleSave = (): void => {
    const payload: CreateAmazonAccountFormData = {
      email,
      password,
      label: label || undefined,
      twoFactorSecret: twoFactorSecret || undefined,
    };
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void createAccount(payload)
      .unwrap()
      .then(() => {
        onClose();
      })
      .catch(() => {
        showMessage({
          type: 'error',
          message: t('translation:common.error'),
        });
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.amazonAdd.title')}
      subtitle={t('translation:settingsHub.drawer.amazonAdd.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: handleSave,
        isLoading: !!isLoading,
      }}
    >
      <BodyStack>
        <ModernTextInput
          label={t('translation:settingsHub.drawer.amazonAdd.label')}
          value={label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setLabel(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.amazonAdd.email')}
          value={email}
          type="email"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.amazonAdd.password')}
          value={password}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.amazonAdd.twoFactorSecret')}
          value={twoFactorSecret}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTwoFactorSecret(e.target.value)
          }
        />
      </BodyStack>
    </Drawer>
  );
};
