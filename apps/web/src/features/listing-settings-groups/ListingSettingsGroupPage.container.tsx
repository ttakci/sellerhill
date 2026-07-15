import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingGroupDrawer } from '../settings/drawers/ListingGroupDrawer';

import {
  useDeleteListingSettingsGroupMutation,
  useGetListingSettingsGroupsQuery,
} from './api/listing-settings-group.api';
import { ListingSettingsGroupPageComponent } from './ListingSettingsGroupPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';

export const ListingSettingsGroupPageContainer = () => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const { data: groups = [], isLoading: isGroupsLoading } = useGetListingSettingsGroupsQuery();
  const [deleteListingSettingsGroup, { isLoading: isDeleting, isSuccess: deleteSuccess }] =
    useDeleteListingSettingsGroupMutation();
  const [isGroupDrawerOpen, setIsGroupDrawerOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  useLoading(isGroupsLoading || isDeleting);

  // Handle delete success
  React.useEffect(() => {
    if (deleteSuccess) {
      showMessage(
        {
          type: 'success',
          headerKey: 'translation:message.success.header',
          descriptionKey: 'listingSettingsGroup:listingSettingsGroup.success.deleted',
          primaryButton: {
            labelKey: 'translation:message.success.ok',
            onClick: closeMessage,
          },
        },
        t
      );
    }
  }, [deleteSuccess, showMessage, closeMessage, t]);

  const handleCreateGroup = () => {
    setEditingGroupId(null);
    setIsGroupDrawerOpen(true);
  };

  const handleEditGroup = (id: string) => {
    setEditingGroupId(id);
    setIsGroupDrawerOpen(true);
  };

  const handleDeleteGroup = (id: string) => {
    showMessage(
      {
        type: 'error',
        headerKey: 'listingSettingsGroup:listingSettingsGroup.confirmDelete',
        descriptionKey: 'listingSettingsGroup:listingSettingsGroup.confirmDeleteMessage',
        primaryButton: {
          labelKey: 'translation:common.delete',
          onClick: () => {
            void deleteListingSettingsGroup(id);
            closeMessage();
          },
        },
        secondaryButton: {
          labelKey: 'translation:common.cancel',
          onClick: closeMessage,
        },
      },
      t
    );
  };

  return (
    <EbayAccountGuard>
      <ListingSettingsGroupPageComponent
        groups={groups}
        onCreateGroup={handleCreateGroup}
        onEditGroup={handleEditGroup}
        onDeleteGroup={handleDeleteGroup}
      />
      <ListingGroupDrawer
        isOpen={isGroupDrawerOpen}
        onClose={() => setIsGroupDrawerOpen(false)}
        editingGroupId={editingGroupId}
      />
    </EbayAccountGuard>
  );
};
