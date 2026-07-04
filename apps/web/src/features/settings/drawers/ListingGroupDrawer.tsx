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

export interface ListingGroupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingId?: string | null;
}

export const ListingGroupDrawer: React.FC<ListingGroupDrawerProps> = ({
  isOpen,
  onClose,
  editingId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const titleKey = editingId
    ? 'translation:settingsHub.drawer.listingGroup.titleEdit'
    : 'translation:settingsHub.drawer.listingGroup.titleNew';

  const handleOpen = (): void => {
    onClose();
    if (editingId) {
      void navigate(`/settings/listing-groups/${editingId}/edit`);
    } else {
      void navigate('/settings/listing-groups/new');
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={t(titleKey)} size="sm">
      <BodyStack>
        <Text variant="body" color="text.secondary">
          {t('translation:settingsHub.drawer.listingGroup.titleNew')}
        </Text>
        <Button variant="primary" onClick={handleOpen}>
          <Text>{t('translation:common.open')}</Text>
        </Button>
      </BodyStack>
    </Drawer>
  );
};
