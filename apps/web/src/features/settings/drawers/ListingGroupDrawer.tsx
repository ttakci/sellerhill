import { Drawer, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { BodyStack } from './ListingGroupDrawer.style';
import type { ListingGroupDrawerProps } from './ListingGroupDrawer.types';

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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t(titleKey)}
      size="md"
      primaryAction={{
        label: t('translation:settingsHub.drawer.listingGroup.openFull'),
        onClick: handleOpen,
      }}
    >
      <BodyStack>
        <Text variant="body" color="text.secondary">
          {t('translation:settingsHub.drawer.listingGroup.titleNew')}
        </Text>
      </BodyStack>
    </Drawer>
  );
};
