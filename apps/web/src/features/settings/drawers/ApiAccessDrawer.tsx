import styled from '@emotion/styled';
import { Button, Drawer, EmptyState, Text, tkn, useUI } from '@repo/ui';
import React from 'react';
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

export interface ApiAccessDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiAccessDrawer: React.FC<ApiAccessDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage } = useUI();

  const handleCreate = (): void => {
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
      <Button variant="primary" onClick={handleCreate}>
        <Text>{t('translation:settingsHub.drawer.apiAccess.createKey')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.apiAccess.title')}
      subtitle={t('translation:settingsHub.drawer.apiAccess.subtitle')}
      footer={footer}
      size="md"
    >
      <BodyStack>
        <NotImplementedNotice />
        <EmptyState
          icon="lock"
          title={t('translation:settingsHub.drawer.apiAccess.noKeys')}
          description={t('translation:settingsHub.drawer.apiAccess.subtitle')}
        />
      </BodyStack>
    </Drawer>
  );
};
