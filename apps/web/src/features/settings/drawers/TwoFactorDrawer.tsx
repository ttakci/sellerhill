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

const QrPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12rem;
  height: 12rem;
  background: ${tkn('colors.surface.secondary')};
  border: 1px dashed ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  margin: 0 auto;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export interface TwoFactorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoFactorDrawer: React.FC<TwoFactorDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState('');

  const handleToggle = (): void => {
    if (enabled) {
      setEnabled(false);
    }
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
      <Button variant="primary" onClick={handleToggle}>
        <Text>
          {enabled
            ? t('translation:settingsHub.drawer.twoFactor.disable')
            : t('translation:settingsHub.drawer.twoFactor.enable')}
        </Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.twoFactor.title')}
      subtitle={t('translation:settingsHub.drawer.twoFactor.subtitle')}
      footer={footer}
      size="md"
    >
      <BodyStack>
        <NotImplementedNotice />
        <StatusRow>
          <Text variant="body" weight="medium">
            {t('translation:settingsHub.drawer.twoFactor.title')}
          </Text>
          <Text variant="body" color="text.secondary">
            {enabled
              ? t('translation:settingsHub.drawer.twoFactor.enabled')
              : t('translation:settingsHub.drawer.twoFactor.disabled')}
          </Text>
        </StatusRow>
        <QrPlaceholder>
          <Text variant="caption" color="text.secondary">
            {t('translation:settingsHub.drawer.twoFactor.scanQr')}
          </Text>
        </QrPlaceholder>
        <ModernTextInput
          label={t('translation:settingsHub.drawer.twoFactor.enterCode')}
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCode(e.target.value)
          }
        />
      </BodyStack>
    </Drawer>
  );
};
