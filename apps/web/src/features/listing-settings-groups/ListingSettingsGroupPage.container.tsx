import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  useDeleteListingSettingsGroupMutation,
  useGetListingSettingsGroupsQuery,
} from './api/listing-settings-group.api';
import { ListingSettingsGroupPageComponent } from './ListingSettingsGroupPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const ListingSettingsGroupPageContainer = () => {
  const { localeNavigate } = useLocale();
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { showMessage, closeMessage } = useUI();

  const { data: groups = [], isLoading: isGroupsLoading } = useGetListingSettingsGroupsQuery();
  const [deleteListingSettingsGroup, { isLoading: isDeleting, isSuccess: deleteSuccess }] =
    useDeleteListingSettingsGroupMutation();

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
    localeNavigate('/settings/listing-groups/new');
  };

  const handleEditGroup = (id: string) => {
    localeNavigate(`/settings/listing-groups/${id}/edit`);
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
    </EbayAccountGuard>
  );
};
