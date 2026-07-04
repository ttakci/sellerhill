import styled from '@emotion/styled';
import {
  Button,
  Drawer,
  ModernTextInput,
  Text,
  tkn,
  useUI,
} from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NotImplementedNotice } from './NotImplementedNotice';

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

const ErrorText = styled(Text)`
  color: ${tkn('colors.semantic.error')};
`;

export interface ChangePasswordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export const ChangePasswordDrawer: React.FC<ChangePasswordDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = (): void => {
    if (next !== confirm) {
      setError(t('translation:settingsHub.drawer.password.mismatch'));
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(t('translation:settingsHub.drawer.password.tooShort'));
      return;
    }
    setError(null);
    showMessage({
      type: 'error',
      message: t('translation:settingsHub.notImplemented.title'),
    });
  };

  const footer = (
    <FooterRow>
      <Button variant="ghost" onClick={onClose}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={handleSave}>
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.password.title')}
      subtitle={t('translation:settingsHub.drawer.password.subtitle')}
      footer={footer}
      size="md"
    >
      <BodyStack>
        <NotImplementedNotice />
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
