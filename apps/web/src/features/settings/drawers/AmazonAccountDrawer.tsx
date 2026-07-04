import styled from '@emotion/styled';
import type { CreateAmazonAccountFormData } from '@repo/shared';
import {
  Button,
  Drawer,
  ModernTextInput,
  Text,
  Textarea,
  tkn,
  useUI,
} from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateAmazonAccountMutation } from '@/features/amazon/api/amazon.api';

const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;

export interface AmazonAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

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

  const footer = (
    <FooterRow>
      {/* eslint-disable @typescript-eslint/no-unsafe-assignment */}
      <Button variant="ghost" onClick={onClose} disabled={isLoading}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={handleSave} isLoading={isLoading}>
        {/* eslint-enable @typescript-eslint/no-unsafe-assignment */}
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.amazonAdd.title')}
      subtitle={t('translation:settingsHub.drawer.amazonAdd.subtitle')}
      footer={footer}
      size="md"
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
        <Textarea
          label={t('translation:settingsHub.drawer.amazonAdd.twoFactorSecret')}
          value={twoFactorSecret}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setTwoFactorSecret(e.target.value)
          }
        />
      </BodyStack>
    </Drawer>
  );
};
