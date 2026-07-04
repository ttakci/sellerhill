import styled from '@emotion/styled';
import { Button, Drawer, Text, tkn } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
`;

export interface StoreConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreConfigDrawer: React.FC<StoreConfigDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleOpen = (): void => {
    onClose();
    void navigate('/settings/store');
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.storeConfig.title')}
      subtitle={t('translation:settingsHub.drawer.storeConfig.subtitle')}
      size="sm"
    >
      <BodyStack>
        <Text variant="body" color="text.secondary">
          {t('translation:settingsHub.drawer.storeConfig.subtitle')}
        </Text>
        <Button variant="primary" onClick={handleOpen}>
          <Text>{t('translation:common.open')}</Text>
        </Button>
      </BodyStack>
    </Drawer>
  );
};
